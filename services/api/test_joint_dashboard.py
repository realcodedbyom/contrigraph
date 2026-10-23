from datetime import timedelta
import pytest
from portfolio import portfolio_workload
from redistribution import joint_schedule, simulate_move
from test_redistribution import projects, START, MOVE


def test_dashboard_matches_preview_before_and_after():
    data = projects()
    preview = simulate_move(data, {'owner', 'helper-user'}, MOVE, START)
    for phase in ['before', 'after']:
        if phase == 'after':
            data['a']['tasks'][0]['owner'] = 'helper'
        dashboard = portfolio_workload(data.items(), START)
        assert {p['projectId']: p['finish'] for p in dashboard['forecasts']} == {p['projectId']: p[phase] for p in preview['impacts']}
        plans, _ = joint_schedule(data, START)
        for person in dashboard['people']:
            for day in person['days']:
                assert day['planned'] <= day['available']
                assert day['overbooked'] == 0
            for task in person['tasks']:
                plan = plans[task['projectId'], task['id']]
                assert sum(a['hours'] for a in task['allocations']) == len(plan['slots']) / 2
                assert task['finish'] == (START + timedelta(days=(plan['finishSlot'] - 1) // 48)).isoformat()


@pytest.mark.parametrize('case', ['blocker', 'timezone', 'capacity', 'owner', 'deferred'])
def test_dashboard_unknown_and_excluded_scope_matches_joint_engine(case):
    data = projects()
    if case == 'blocker': data['a']['tasks'][1]['blocker'] = 'Needs review'
    if case == 'timezone': data['b']['timezone'] = 'UTC'
    if case == 'capacity':
        for p in data.values(): p['members'][0]['capacity'] = 0
    if case == 'owner': data['a']['tasks'][1]['owner'] = ''
    if case == 'deferred': data['a']['tasks'][1]['status'] = 'Deferred'
    result = portfolio_workload(data.items(), START)
    if case == 'timezone':
        assert result['scheduleError']
        assert all(t['finish'] is None and t['allocations'] == [] for p in result['people'] for t in p['tasks'])
    else:
        plans, forecasts = joint_schedule(data, START)
        assert {p['projectId']: p['finish'] for p in result['forecasts']} == forecasts
        for person in result['people']:
            for task in person['tasks']:
                assert task['unscheduled'] == (plans[task['projectId'], task['id']]['finishSlot'] is None)


def test_empty_portfolio():
    result = portfolio_workload([], START)
    assert result['people'] == result['forecasts'] == []
    assert result['scheduleError'] == ''


def test_conflicting_calendars_preserve_shared_capacity_and_allocations():
    data = projects()
    data['b']['members'][0]['overrides'] = {START.isoformat(): 0}
    result = portfolio_workload(data.items(), START)
    lead = next(p for p in result['people'] if p['id'] == 'user:owner')
    assert lead['calendarConflict']
    assert lead['days'][0]['available'] == lead['days'][0]['planned'] == 0
    assert all(day['planned'] <= day['available'] for day in lead['days'])
