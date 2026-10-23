from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from models import ProjectData, Member, Task, Milestone


def starter(user, sample=True):
    now = datetime.now(ZoneInfo('Asia/Kolkata')).date()
    due = lambda n: now + timedelta(days=n)
    lead = Member(id='lead', userId=user['id'], name=user['name'], initials=''.join(n[0] for n in user['name'].split())[:2].upper(), role='lead', skills=['scheduling', 'backend', 'testing', 'documentation'], color='#ead6c0')
    if not sample:
        return ProjectData(name='New project', deadline=due(14), members=[lead]).model_dump(mode='json')
    team = [lead, Member(id='database', name='Database teammate', skills=['database', 'backend', 'documentation'], color='#dbe5cf'),
            Member(id='interface', name='Interface teammate', skills=['frontend', 'testing', 'documentation'], color='#dcdcef')]
    tasks = [
        Task(id='CG-01', title='Define project acceptance criteria', owner='lead', effort=4, remaining=0, status='Done', due=due(1), requiredSkills=['documentation'], milestone='Foundation', acceptedBy='lead', acceptance='Starter example'),
        Task(id='CG-02', title='Write task-flow test cases', owner='lead', effort=12, remaining=12, priority='High', due=due(3), requiredSkills=['testing']),
        Task(id='CG-03', title='Build the scheduling engine', owner='lead', effort=12, remaining=12, priority='Medium', due=due(5), requiredSkills=['scheduling'], description='Only the lead currently has scheduling skills. Protect their time by transferring compatible side work.'),
        Task(id='CG-04', title='Connect forecast to dashboard', owner='lead', effort=6, remaining=6, due=due(7), dependencies=['CG-03'], requiredSkills=['backend']),
        Task(id='CG-05', title='Authentication and project permissions', owner='database', effort=10, remaining=10, priority='High', due=due(4), requiredSkills=['database']),
        Task(id='CG-06', title='Audit history and evidence storage', owner='database', effort=8, remaining=8, due=due(6), dependencies=['CG-05'], requiredSkills=['database']),
        Task(id='CG-07', title='Build the dependency visualization', owner='interface', effort=6, remaining=6, due=due(4), requiredSkills=['frontend']),
        Task(id='CG-08', title='Prepare the final demo walkthrough', owner='interface', effort=4, remaining=4, priority='Low', due=due(12), requiredSkills=['documentation'], milestone='Ready to ship')]
    return ProjectData(name='ContriGraph', description='Starter project · A single-specialist recovery scenario. Replace these example tasks with your team’s work.', deadline=due(10), members=team, tasks=tasks,
                       milestones=[Milestone(id='foundation', name='Foundation', due=due(2)), Milestone(id='prototype', name='Working prototype', due=due(7)), Milestone(id='delivery', name='Ready to ship', due=due(10))]).model_dump(mode='json')
