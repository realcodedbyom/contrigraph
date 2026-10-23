"""Joint, half-hour portfolio simulation. Proposals never move tasks between projects."""
from copy import deepcopy
from datetime import timedelta
from engine import validate, active_scope, daily_hours, eligible, HORIZON


def identity(pid, member):
    return ('user', member['userId']) if member.get('userId') else (pid, member['id'])


def joint_schedule(projects, start):
    if len({p['timezone'] for p in projects.values()}) > 1:
        raise ValueError('Align project timezones to calculate joint dates and allocations. Capacity totals are informational until calendars align.')
    calendars, tasks, members, excluded = {}, {}, {}, set()
    for pid, project in projects.items():
        graph = validate(project)
        active, deferred = active_scope(project, graph)
        excluded.update((pid, tid) for tid in deferred)
        for member in project['members']:
            members[pid, member['id']] = member
            key = identity(pid, member)
            slots = {offset * 48 + 18 + n for offset in range(HORIZON)
                     for n in range(int(daily_hours(project, member, start + timedelta(days=offset)) * 2))}
            # Shared people can only work in slots allowed by every declared calendar.
            calendars[key] = calendars[key] & slots if key in calendars else slots
        for task in active:
            tasks[pid, task['id']] = task
    used = {key: set() for key in calendars}
    result = {key: {'finishSlot': 0, 'startSlot': 0, 'slots': [], 'reason': ''} for key, task in tasks.items() if task['status'] == 'Done'}
    pending = sorted([key for key, task in tasks.items() if task['status'] != 'Done'], key=lambda key: (
        tasks[key]['status'] != 'In progress', tasks[key].get('rank', 100),
        {'High': 0, 'Medium': 1, 'Low': 2}[tasks[key]['priority']], tasks[key]['due'], key))
    while pending:
        key = next(key for key in pending if all((key[0], d) in result for d in tasks[key]['dependencies']))
        pending.remove(key)
        task, pid = tasks[key], key[0]
        member = members.get((pid, task['owner']))
        dependencies = [result[pid, d] for d in task['dependencies']]
        reason = ''
        if not member or not eligible(member, task):
            reason = 'A qualified owner is required.'
        elif any(d['finishSlot'] is None for d in dependencies):
            reason = 'An upstream task has no feasible schedule.'
        elif task.get('blocker'):
            reason = 'Resolve open blockers before approving automatic redistribution.'
        if reason:
            result[key] = {'finishSlot': None, 'startSlot': None, 'slots': [], 'reason': reason}
            continue
        release = max([0] + [d['finishSlot'] for d in dependencies])
        if task.get('earliestStart'):
            from datetime import date
            release = max(release, (date.fromisoformat(task['earliestStart']) - start).days * 48 + 18)
        owner = identity(pid, member)
        needed = int(task['remaining'] * 2)
        slots = [s for s in sorted(calendars[owner] - used[owner]) if s >= release][:needed]
        if len(slots) != needed:
            result[key] = {'finishSlot': None, 'startSlot': None, 'slots': [], 'reason': 'Insufficient shared capacity within 180 days.'}
            continue
        used[owner].update(slots)
        result[key] = {'finishSlot': slots[-1] + 1 if slots else release, 'startSlot': slots[0] if slots else release, 'slots': slots, 'reason': ''}
    forecasts = {}
    for pid, project in projects.items():
        rows = [row for key, row in result.items() if key[0] == pid]
        last = max([0] + [row['finishSlot'] or 0 for row in rows])
        forecasts[pid] = None if any(row['finishSlot'] is None for row in rows) else (start + timedelta(days=max(0, (last - 1) // 48))).isoformat()
    return result, forecasts


def simulate_move(projects, covered, proposal, start, baseline=None):
    pid, tid, mid = proposal['projectId'], proposal['taskId'], proposal['memberId']
    if pid not in projects:
        raise ValueError('Project is unavailable.')
    project = projects[pid]
    task = next((t for t in project['tasks'] if t['id'] == tid), None)
    recipient = next((m for m in project['members'] if m['id'] == mid), None)
    if not task or not recipient:
        raise ValueError('Choose an existing task and a teammate in its project.')
    owner = next((m for m in project['members'] if m['id'] == task['owner']), None)
    if task['status'] != 'To do' or task.get('locked') or task['remaining'] <= 0:
        raise ValueError('Only unlocked, unstarted work with remaining effort can move.')
    if not owner or owner['id'] == mid:
        raise ValueError('Choose a different qualified owner for assigned work.')
    if not eligible(recipient, task):
        raise ValueError('The recipient must have every required skill. Keep the sole specialist assigned.')
    if not all(m.get('userId') and m['userId'] in covered for m in [owner, recipient]):
        raise ValueError('Both people must claim their profiles, and all their project commitments must be visible to verify this move.')
    graph = validate(project)
    _, excluded = active_scope(project, graph)
    if tid in excluded:
        raise ValueError('Deferred downstream scope cannot be reassigned automatically.')
    before, before_dates = baseline or joint_schedule(projects, start)
    changed = deepcopy(projects)
    next(t for t in changed[pid]['tasks'] if t['id'] == tid)['owner'] = mid
    after, after_dates = joint_schedule(changed, start)
    if any(row['finishSlot'] is None for row in [*before.values(), *after.values()]):
        raise ValueError('A portfolio forecast is incomplete. Resolve missing owners, skills, blockers or capacity before approving redistribution.')
    if any(after[key]['finishSlot'] > row['finishSlot'] for key, row in before.items()):
        raise ValueError('This move delays at least one task in the shared schedule. It is not a safe automatic recommendation.')
    improved = [key for key in before if after[key]['finishSlot'] < before[key]['finishSlot']]
    if not improved:
        raise ValueError('This move provides no earlier task completion in the shared schedule.')
    protected = [t['id'] for t in project['tasks'] if t['owner'] == owner['id'] and t['status'] not in ['Done', 'Deferred'] and t['id'] not in excluded and sum(eligible(m, t) for m in project['members']) == 1]
    impacts = [{'projectId': key, 'projectName': p['name'], 'deadline': p['deadline'], 'before': before_dates[key], 'after': after_dates[key]} for key, p in projects.items()]
    return {'proposal': proposal, 'taskTitle': task['title'], 'from': owner['name'], 'to': recipient['name'], 'hours': task['remaining'],
            'protectedTasks': protected, 'impacts': impacts, 'improvedTasks': [{'projectId': key[0], 'taskId': key[1], 'hoursEarlier': (before[key]['finishSlot'] - after[key]['finishSlot']) / 2} for key in improved],
            'explanation': 'Every visible project was jointly rescheduled with one shared calendar per linked person. No task finishes later; at least one finishes earlier. Hours earlier are elapsed half-hour slots, not effort saved.',
            'assumptions': ['Estimates and declared skills must be accurate.', 'Unclaimed profiles in other work remain independent planning placeholders.', 'Different shared calendars use their common available slots.', 'The deterministic greedy schedule is feasible, not guaranteed optimal. External work outside this platform remains unknown.']}


def suggest_moves(projects, covered, lead_projects, start):
    suggestions, notes, checked = [], [], 0
    if sum(len(p['tasks']) for p in projects.values()) > 500:
        return {'suggestions': [], 'notes': ['Automatic search is limited to 500 tasks. No safe move was verified.'], 'truncated': True}
    try:
        baseline = joint_schedule(projects, start)
    except ValueError as error:
        return {'suggestions': [], 'notes': [str(error)], 'truncated': False}
    if any(r['finishSlot'] is None for r in baseline[0].values()):
        return {'suggestions': [], 'notes': ['A joint forecast is incomplete. Resolve missing owners, skills, open blockers or shared capacity first.'], 'truncated': False}
    for pid, project in projects.items():
        if pid not in lead_projects:
            continue
        for task in project['tasks']:
            if task['status'] != 'To do' or task.get('locked'):
                continue
            for member in project['members']:
                if task['owner'] == member['id'] or not eligible(member, task):
                    continue
                if checked >= 40:
                    return {'suggestions': suggestions[:8], 'notes': notes[:3], 'truncated': True}
                checked += 1
                try:
                    preview = simulate_move(projects, covered, {'projectId': pid, 'taskId': task['id'], 'memberId': member['id']}, start, baseline)
                    suggestions.append(preview)
                except ValueError as error:
                    if str(error) not in notes:
                        notes.append(str(error))
    return {'suggestions': sorted(suggestions, key=lambda s: (-len(s['protectedTasks']), -len(s['improvedTasks'])))[:8],
            'notes': notes[:3] if not suggestions else [], 'truncated': len(suggestions) > 8}
