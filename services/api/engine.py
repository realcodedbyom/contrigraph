"""Deterministic planning. NetworkX validates structure; calendar slots enforce capacity."""
from copy import deepcopy
from datetime import date, datetime, timedelta
from math import ceil
from zoneinfo import ZoneInfo
import networkx as nx
from models import ProjectData, Scenario

HORIZON = 180


def today(project: dict) -> date:
    return datetime.now(ZoneInfo(project.get('timezone', 'Asia/Kolkata'))).date()


def eligible(member: dict, task: dict) -> bool:
    return set(task.get('requiredSkills', [])) <= set(member.get('skills', []))


def validate(project: dict):
    ProjectData.model_validate(project)
    tasks = project['tasks']
    ids = [t['id'] for t in tasks]
    mids = [m['id'] for m in project['members']]
    if len(set(ids)) != len(ids) or len(set(mids)) != len(mids):
        raise ValueError('Task and member identifiers must be unique.')
    if not any(m['role'] == 'lead' for m in project['members']):
        raise ValueError('A project needs a team lead.')
    graph = nx.DiGraph()
    graph.add_nodes_from(ids)
    for task in tasks:
        if task['owner'] and task['owner'] not in mids:
            raise ValueError('The task owner must belong to this project.')
        for dep in task['dependencies']:
            if dep not in ids:
                raise ValueError(f'Unknown prerequisite: {dep}')
            graph.add_edge(dep, task['id'])
    if not nx.is_directed_acyclic_graph(graph):
        raise ValueError('This dependency would create a cycle.')
    return graph


def active_scope(project: dict, graph) -> tuple[list[dict], set[str]]:
    excluded = set()
    for task in project['tasks']:
        if task['status'] == 'Deferred':
            excluded.add(task['id'])
            excluded.update(nx.descendants(graph, task['id']))
    return [t for t in project['tasks'] if t['id'] not in excluded], excluded


def daily_hours(project: dict, member: dict, day: date) -> float:
    key = day.isoformat()
    if key in project.get('holidays', []):
        return 0
    if key in member.get('overrides', {}):
        return member['overrides'][key]
    weekdays = member.get('weekdays', [0, 1, 2, 3, 4])
    if day.weekday() not in weekdays or not weekdays:
        return 0
    # Distribute the weekly half-hours exactly instead of silently rounding each day down.
    base, extra = divmod(int(member['capacity'] * 2), len(weekdays))
    index = sorted(weekdays).index(day.weekday())
    return min(12, (base + (1 if index < extra else 0)) / 2)


def schedule(project: dict, start: date | None = None, prioritize: str = '') -> dict:
    graph = validate(project)
    start = start or today(project)
    active, excluded = active_scope(project, graph)
    by_id = {t['id']: t for t in project['tasks']}
    members = {m['id']: m for m in project['members']}
    # All windows begin at 09:00 project-local time; capacity may span working days.
    slots = {}
    for member in members.values():
        slots[member['id']] = []
        for offset in range(HORIZON):
            day = start + timedelta(days=offset)
            count = int(daily_hours(project, member, day) * 2 + 1e-8)
            slots[member['id']].extend(offset * 48 + 18 + n for n in range(count))
    used = {mid: set() for mid in members}
    result = {t['id']: {'start': None, 'finish': None, 'finishSlot': 0, 'allocations': [], 'state': 'done', 'reason': ''}
              for t in active if t['status'] == 'Done'}
    # Static urgency plus active-work preservation; a scenario can explicitly prioritize an unstarted task.
    key = lambda t: (0 if t['status'] == 'In progress' else 1, t.get('rank', 100), 0 if t['id'] == prioritize else 1,
                     {'High': 0, 'Medium': 1, 'Low': 2}[t['priority']], t['due'], t['id'])
    pending = sorted([t for t in active if t['status'] != 'Done'], key=key)
    while pending:
        task = next(t for t in pending if all(d in result or d in excluded for d in t['dependencies']))
        pending.remove(task)
        reason = ''
        qualified = [m for m in members.values() if eligible(m, task)]
        owner = members.get(task['owner'])
        if not qualified:
            reason = 'No team member has all required skills.'
        elif not owner:
            reason = 'Choose a qualified task owner.'
        elif not eligible(owner, task):
            reason = 'Assigned member does not have all required skills.'
        elif any(result[d]['state'] == 'unscheduled' for d in task['dependencies']):
            reason = 'A prerequisite has no feasible schedule.'
        elif task.get('blocker') and not task.get('blockedUntil'):
            reason = 'Open blocker has no expected resolution date.'
        if reason:
            result[task['id']] = {'start': None, 'finish': None, 'finishSlot': None, 'allocations': [], 'state': 'unscheduled', 'reason': reason}
            continue
        release = max([0] + [result[d]['finishSlot'] for d in task['dependencies']])
        for field in ['earliestStart', 'blockedUntil']:
            if task.get(field):
                release = max(release, (date.fromisoformat(task[field]) - start).days * 48 + 18)
        needed = ceil(task['remaining'] * 2)
        candidates = [s for s in slots[owner['id']] if s >= release and s not in used[owner['id']]][:needed]
        if len(candidates) < needed:
            result[task['id']] = {'start': None, 'finish': None, 'finishSlot': None, 'allocations': [], 'state': 'unscheduled', 'reason': f'Insufficient calendar capacity within {HORIZON} days.'}
            continue
        used[owner['id']].update(candidates)
        finish_slot = candidates[-1] + 1 if candidates else release
        begin_slot = candidates[0] if candidates else release
        allocations = {}
        for slot in candidates:
            day = (start + timedelta(days=slot // 48)).isoformat()
            allocations[day] = allocations.get(day, 0) + .5
        result[task['id']] = {'start': (start + timedelta(days=begin_slot // 48)).isoformat(),
                              'finish': (start + timedelta(days=max(0, (finish_slot - 1) // 48))).isoformat(),
                              'finishSlot': finish_slot, 'allocations': [{'date': day, 'hours': hours} for day, hours in allocations.items()],
                              'state': 'conditional' if task.get('blocker') else 'scheduled', 'reason': task.get('blocker', '')}
    unscheduled = [tid for tid, r in result.items() if r['state'] == 'unscheduled']
    last = max([0] + [r['finishSlot'] or 0 for r in result.values()])
    finish = (start + timedelta(days=max(0, (last - 1) // 48))).isoformat()
    return {'asOf': start.isoformat(), 'date': None if unscheduled else finish,
            'partialDate': finish, 'delay': None if unscheduled else max(0, (date.fromisoformat(finish) - date.fromisoformat(project['deadline'])).days),
            'complete': not unscheduled, 'conditional': any(r['state'] == 'conditional' for r in result.values()),
            'unscheduled': unscheduled, 'excluded': sorted(excluded), 'tasks': result,
            'assumptions': ['Half-hour slots; work may pause between days.', '09:00 start windows with member working days, holidays and overrides.',
                            'Greedy ordering is feasible, not guaranteed optimal.', 'Today is treated as a full planning day; enter an override for hours already consumed.',
                            'In-review tasks retain remaining effort until accepted.']}


def workload(project: dict, forecast: dict) -> list[dict]:
    start = date.fromisoformat(forecast['asOf'])
    rows = []
    for member in project['members']:
        tasks = [t for t in project['tasks'] if t['owner'] == member['id'] and t['status'] not in ['Done', 'Deferred'] and t['id'] not in forecast['excluded']]
        window = start + timedelta(days=7)
        due = [t for t in tasks if date.fromisoformat(t['due']) < window]
        capacity = sum(daily_hours(project, member, start + timedelta(days=n)) for n in range(7))
        required = sum(t['remaining'] for t in due)
        blocked = sum(t['remaining'] for t in tasks if t.get('blocker') or any(next(x for x in project['tasks'] if x['id'] == d)['status'] != 'Done' for d in t['dependencies']))
        rows.append({**member, 'assigned': sum(t['remaining'] for t in tasks), 'dueEffort': required, 'available': round(capacity, 2),
                     'blocked': blocked, 'utilization': round(required / capacity * 100) if capacity else (None if required else 0),
                     'scheduledThisWeek': sum(a['hours'] for t in tasks for a in forecast['tasks'].get(t['id'], {}).get('allocations', []) if a['date'] < window.isoformat())})
    return rows


def skill_risks(project: dict, forecast: dict) -> list[dict]:
    graph = validate(project)
    risks = []
    for task in project['tasks']:
        if task['status'] in ['Done', 'Deferred'] or task['id'] in forecast['excluded']:
            continue
        qualified = [m for m in project['members'] if eligible(m, task)]
        if len(qualified) < 2:
            risks.append({'taskId': task['id'], 'title': task['title'], 'skills': task['requiredSkills'],
                          'kind': 'missing-skill' if not qualified else 'single-specialist',
                          'members': [m['id'] for m in qualified], 'downstream': sorted(nx.descendants(graph, task['id'])),
                          'reason': 'No qualified member. Add skills or review scope.' if not qualified else f"Only {qualified[0]['name']} meets all skill requirements. Protect their time; do not force reassignment."})
    return risks


def apply_scenario(project: dict, scenario: dict) -> tuple[dict, list[str]]:
    Scenario.model_validate(scenario)
    changed = deepcopy(project)
    task = next((t for t in changed['tasks'] if t['id'] == scenario.get('taskId')), None)
    kind = scenario['kind']
    affected = []
    if kind in ['reassign', 'prioritize', 'defer'] and not task:
        raise ValueError('Choose an existing task.')
    if kind == 'reassign':
        member = next((m for m in changed['members'] if m['id'] == scenario['memberId']), None)
        if task['status'] != 'To do' or task.get('locked'):
            raise ValueError('Only unlocked, unstarted tasks can be reassigned in recovery.')
        if not member or not eligible(member, task):
            raise ValueError('The recipient must have every required skill. The specialist stays assigned.')
        task['owner'] = member['id']
        affected = [task['id']]
    elif kind == 'prioritize':
        if task['status'] != 'To do':
            raise ValueError('Only unstarted work can be reordered.')
        task['priority'] = 'High'
        task['rank'] = max(-10000, min(t.get('rank', 100) for t in changed['tasks']) - 1)
        affected = [task['id']]
    elif kind == 'defer':
        graph = validate(changed)
        affected = sorted({task['id']} | nx.descendants(graph, task['id']))
        if any(t['status'] in ['Done', 'In progress', 'In review'] for t in changed['tasks'] if t['id'] in affected):
            raise ValueError('Scope deferral cannot remove completed, active, or submitted work. Split that work explicitly first.')
        for t in changed['tasks']:
            if t['id'] in affected:
                t['status'] = 'Deferred'
    elif kind == 'deadline':
        changed['deadline'] = date.fromisoformat(scenario['value']).isoformat()
    elif kind == 'availability':
        member = next((m for m in changed['members'] if m['id'] == scenario['memberId']), None)
        if not member:
            raise ValueError('Choose an existing member.')
        member['capacity'] = float(scenario['value'])
    validate(changed)
    return changed, affected


def recommend(project: dict, forecast: dict, risks: list[dict]) -> list[dict]:
    options = []
    loads = workload(project, forecast)
    protected = {mid for r in risks if r['kind'] == 'single-specialist' for mid in r['members']}
    overloaded = {m['id'] for m in loads if m['utilization'] is None or m['utilization'] > 100}
    for task in project['tasks']:
        if task['status'] != 'To do' or task.get('locked') or task['owner'] not in protected | overloaded:
            continue
        for member in project['members']:
            if member['id'] == task['owner'] or not eligible(member, task):
                continue
            load = next(m for m in loads if m['id'] == member['id'])
            if load['available'] < load['dueEffort'] + task['remaining']:
                continue
            scenario = {'version': 1, 'kind': 'reassign', 'taskId': task['id'], 'memberId': member['id'], 'value': '', 'reason': 'Protect specialist time and balance near-term work.'}
            changed, _ = apply_scenario(project, scenario)
            after = schedule(changed, date.fromisoformat(forecast['asOf']))
            if after['complete'] and (not forecast['complete'] or after['date'] <= forecast['date']):
                options.append({'id': f"move-{task['id']}-{member['id']}", 'kind': 'reassign', 'taskId': task['id'], 'memberId': member['id'],
                                'title': f"Assign {task['title']} to {member['name']}", 'reason': 'Qualified recipient, enough seven-day capacity, and delivery does not worsen.',
                                'forecast': after['date'], 'hours': task['remaining'], 'recoveredDays': (date.fromisoformat(forecast['date']) - date.fromisoformat(after['date'])).days if forecast['date'] else None})
    return sorted(options, key=lambda x: (-(x['recoveredDays'] or 0), -x['hours']))[:8]


def analyze(project: dict, events: list[dict] | None = None, start: date | None = None, prioritize: str = '', include_recommendations: bool = True) -> dict:
    forecast = schedule(project, start, prioritize)
    risks = skill_risks(project, forecast)
    loads = workload(project, forecast)
    reasons = []
    for status, limit in project.get('wipLimits', {}).items():
        count = sum(t['status'] == status for t in project['tasks'])
        if count > limit:
            reasons.append({'severity': 'amber', 'code': 'wip', 'text': f'{status} has {count} tasks against a limit of {limit}. Finish or review existing work before starting more.'})
    if not forecast['complete']:
        reasons.append({'severity': 'red', 'code': 'incomplete', 'text': f"{len(forecast['unscheduled'])} tasks cannot be scheduled. Delivery date is unknown."})
    elif forecast['delay']:
        reasons.append({'severity': 'red' if forecast['delay'] > 2 else 'amber', 'code': 'delay', 'text': f"Forecast is {forecast['delay']} calendar days past the deadline."})
    for load in loads:
        if load['utilization'] is None or load['utilization'] > 100:
            reasons.append({'severity': 'amber', 'code': 'capacity', 'text': f"{load['name']} has {load['dueEffort']}h due against {load['available']}h available in the next seven days."})
    for task in project['tasks']:
        if task['status'] not in ['Done', 'Deferred'] and task['id'] not in forecast['excluded']:
            if task.get('blocker'):
                reasons.append({'severity': 'amber', 'code': 'blocker', 'taskId': task['id'], 'text': task['blocker']})
            if task['due'] < forecast['asOf']:
                reasons.append({'severity': 'amber', 'code': 'overdue', 'taskId': task['id'], 'text': f"{task['title']} is overdue."})
    for risk in risks:
        reasons.append({'severity': 'red' if risk['kind'] == 'missing-skill' else 'amber', 'code': risk['kind'], 'taskId': risk['taskId'], 'text': risk['reason']})
    tone = 'red' if any(r['severity'] == 'red' for r in reasons) else 'amber' if reasons else 'green'
    contributions = []
    for member in project['members']:
        done = [t for t in project['tasks'] if t['owner'] == member['id'] and t['status'] == 'Done']
        contributions.append({'memberId': member['id'], 'delivered': len(done), 'acceptedEffort': sum(t['effort'] for t in done),
                              'reviews': sum(e['kind'] == 'approved' and e['actor'] == member['id'] and e.get('meta', {}).get('independent', False) for e in events or []),
                              'documentation': sum(c['kind'] == 'documentation' and c['author'] == member['id'] for t in project['tasks'] for c in t['comments']),
                              'blockerResolutions': sum(c['kind'] == 'blocker-resolution' and c['author'] == member['id'] for t in project['tasks'] for c in t['comments'])})
    return {'forecast': forecast, 'workload': loads, 'skillRisks': risks, 'health': {'tone': tone, 'label': {'red': 'At risk', 'amber': 'Needs attention', 'green': 'On track'}[tone], 'reasons': reasons},
            'recommendations': recommend(project, forecast, risks) if include_recommendations else [], 'contributions': contributions,
            'summary': {'total': len(project['tasks']), 'done': sum(t['status'] == 'Done' for t in project['tasks']), 'deferred': len(forecast['excluded']),
                        'remaining': sum(t['remaining'] for t in project['tasks'] if t['status'] not in ['Done', 'Deferred'] and t['id'] not in forecast['excluded']),
                        'blockers': sum(bool(t.get('blocker')) and t['status'] not in ['Done', 'Deferred'] for t in project['tasks'])}}
