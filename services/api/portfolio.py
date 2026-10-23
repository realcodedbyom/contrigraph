"""Permission-scoped workload aggregation; never adds a shared person's capacity twice."""
from datetime import timedelta
from engine import daily_hours, validate, active_scope
from redistribution import joint_schedule


def portfolio_workload(projects, start):
    projects = list(projects)
    schedule_error = ''
    try:
        plans, forecasts = joint_schedule(dict(projects), start)
    except ValueError as error:
        plans, forecasts = {}, {pid: None for pid, _ in projects}
        schedule_error = str(error)
    days = [(start + timedelta(days=i)).isoformat() for i in range(7)]
    people = {}
    unassigned = []
    for pid, data in projects:
        _, excluded = active_scope(data, validate(data))
        unassigned.extend({'projectId': pid, 'projectName': data['name'], 'id': t['id'], 'title': t['title'], 'remaining': t['remaining']} for t in data['tasks'] if not t['owner'] and t['status'] not in ['Done', 'Deferred'] and t['id'] not in excluded)
        for member in data['members']:
            key = 'user:' + member['userId'] if member.get('userId') else f"roster:{pid}:{member['id']}"
            row = people.setdefault(key, {'id': key, 'name': member['name'], 'linked': bool(member.get('userId')), 'projects': [], 'tasks': [], 'calendars': [], 'timezones': []})
            row['projects'].append({'id': pid, 'name': data['name']})
            row['timezones'].append(data['timezone'])
            row['calendars'].append([daily_hours(data, member, start + timedelta(days=i)) for i in range(7)])
            for task in data['tasks']:
                if task['owner'] != member['id'] or task['status'] in ['Done', 'Deferred'] or task['id'] in excluded:
                    continue
                plan = plans.get((pid, task['id']), {'finishSlot': None, 'startSlot': None, 'slots': [], 'reason': schedule_error})
                allocations = {}
                for slot in plan['slots']:
                    day = (start + timedelta(days=slot // 48)).isoformat()
                    allocations[day] = allocations.get(day, 0) + .5
                finish = None if plan['finishSlot'] is None else (start + timedelta(days=max(0, (plan['finishSlot'] - 1) // 48))).isoformat()
                begin = None if plan['startSlot'] is None else (start + timedelta(days=plan['startSlot'] // 48)).isoformat()
                row['tasks'].append({'projectId': pid, 'projectName': data['name'], 'id': task['id'], 'title': task['title'], 'due': task['due'], 'remaining': task['remaining'], 'status': task['status'], 'unscheduled': plan['finishSlot'] is None, 'start': begin, 'finish': finish, 'reason': plan['reason'], 'late': bool(finish and finish > task['due']), 'allocations': [{'date': day, 'hours': hours} for day, hours in sorted(allocations.items())]})
    for row in people.values():
        calendars = row.pop('calendars')
        zones = row.pop('timezones')
        row['calendarConflict'] = any(c != calendars[0] for c in calendars[1:]) or len(set(zones)) > 1
        row['days'] = []
        for i, day in enumerate(days):
            available = min(c[i] for c in calendars)
            planned = sum(a['hours'] for t in row['tasks'] for a in t['allocations'] if a['date'] == day)
            row['days'].append({'date': day, 'available': available, 'planned': planned, 'overbooked': max(0, planned - available)})
        row['available'] = sum(d['available'] for d in row['days'])
        row['dueEffort'] = sum(t['remaining'] for t in row['tasks'] if t['due'] <= days[-1])
        row['remaining'] = sum(t['remaining'] for t in row['tasks'])
        row['overloaded'] = row['dueEffort'] > row['available'] or any(t['late'] for t in row['tasks'])
        row['unscheduled'] = sum(t['unscheduled'] for t in row['tasks'])
    return {'asOf': start.isoformat(), 'timezone': projects[0][1]['timezone'] if projects else 'Asia/Kolkata', 'scheduleError': schedule_error, 'forecasts': [{'projectId': pid, 'projectName': data['name'], 'deadline': data['deadline'], 'finish': forecasts[pid]} for pid, data in projects], 'days': days, 'projectCount': len(projects), 'unassigned': unassigned, 'people': sorted(people.values(), key=lambda r: (not r['overloaded'], r['name'].lower())),
            'scope': 'Only projects you can access are included. Other commitments are unknown.',
            'capacityRule': 'Dashboard and redistribution previews use the same joint schedule. Linked accounts share one calendar using common available slots. Unclaimed roster entries stay separate. Overload means due effort exceeds this week’s capacity or a task finishes late, even when daily slots fit. Mixed timezones require alignment before scheduling; capacity totals remain informational.'}
