from datetime import date
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, ConfigDict, Field, field_validator, StrictInt


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Member(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    userId: str | None = None
    name: str = Field(min_length=1, max_length=100)
    initials: str = Field(default='', max_length=4)
    role: Literal['lead', 'member', 'reviewer'] = 'member'
    capacity: float = Field(default=20, ge=0, le=84, multiple_of=.5)
    skills: list[str] = Field(default_factory=list, max_length=30)
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], max_length=7)
    overrides: dict[str, float] = Field(default_factory=dict, max_length=180)
    color: str = '#dedfce'

    @field_validator('weekdays')
    @classmethod
    def weekdays_valid(cls, v):
        if len(set(v)) != len(v) or any(x < 0 or x > 6 for x in v):
            raise ValueError('Working weekdays must be unique values from 0 to 6.')
        return v

    @field_validator('overrides')
    @classmethod
    def overrides_valid(cls, v):
        for day, hours in v.items():
            date.fromisoformat(day)
            if not 0 <= hours <= 12 or hours * 2 != int(hours * 2):
                raise ValueError('Calendar overrides require 0–12 hours in half-hour steps.')
        return v


class Comment(StrictModel):
    id: str
    author: str
    text: str = Field(max_length=4000)
    kind: Literal['comment', 'documentation', 'blocker-resolution'] = 'comment'
    time: str


class Task(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default='', max_length=5000)
    owner: str = ''
    effort: float = Field(default=4, gt=0, le=500, multiple_of=.5)
    remaining: float = Field(default=4, ge=0, le=500, multiple_of=.5)
    status: Literal['To do', 'In progress', 'In review', 'Done', 'Deferred'] = 'To do'
    priority: Literal['High', 'Medium', 'Low'] = 'Medium'
    due: date
    dependencies: list[str] = Field(default_factory=list, max_length=100)
    requiredSkills: list[str] = Field(default_factory=lambda: ['development'], max_length=10)
    milestone: str = 'Working prototype'
    blocker: str = Field(default='', max_length=500)
    blockedUntil: date | None = None
    earliestStart: date | None = None
    locked: bool = False
    rank: int = Field(default=100, ge=-10000, le=10000)
    submittedBy: str | None = None
    acceptedBy: str | None = None
    acceptance: str | None = None
    comments: list[Comment] = Field(default_factory=list, max_length=300)
    files: list[dict] = Field(default_factory=list, max_length=10)

    @field_validator('title')
    @classmethod
    def title_valid(cls, value):
        if not value.strip():
            raise ValueError('Task title cannot be blank.')
        return value.strip()


class Milestone(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    due: date


class ProgressUpdate(StrictModel):
    id: str
    author: str
    time: str
    health: Literal['On track', 'At risk', 'Off track']
    summary: str = Field(min_length=1, max_length=3000)
    nextSteps: str = Field(min_length=1, max_length=3000)


class ProjectData(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)
    deadline: date
    timezone: str = 'Asia/Kolkata'
    holidays: list[date] = Field(default_factory=list, max_length=100)
    members: list[Member] = Field(min_length=1, max_length=30)
    tasks: list[Task] = Field(default_factory=list, max_length=200)
    milestones: list[Milestone] = Field(default_factory=list, max_length=30)
    updates: list[ProgressUpdate] = Field(default_factory=list, max_length=500)
    wipLimits: dict[str, StrictInt] = Field(default_factory=dict)

    @field_validator('wipLimits')
    @classmethod
    def wip_valid(cls, value):
        if any(key not in ['In progress', 'In review'] or limit < 1 or limit > 200 for key, limit in value.items()):
            raise ValueError('WIP limits must be 1–200 for In progress or In review. Omit a limit to disable it.')
        return value

    @field_validator('timezone')
    @classmethod
    def timezone_valid(cls, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError('Choose a valid IANA timezone.')
        return value


class Command(StrictModel):
    version: int = Field(ge=1)
    type: Literal['task.save', 'task.status', 'task.approve', 'task.blocker', 'member.save', 'project.update', 'milestone.save', 'comment.add', 'scenario.apply', 'progress.add']
    payload: dict = Field(default_factory=dict)


class Scenario(StrictModel):
    version: int = Field(ge=1)
    kind: Literal['reassign', 'prioritize', 'defer', 'deadline', 'availability']
    taskId: str = ''
    memberId: str = ''
    value: str = ''
    reason: str = Field(default='', max_length=500)


class Credentials(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default='', max_length=100)

    @field_validator('email')
    @classmethod
    def email_valid(cls, v):
        if '@' not in v or '.' not in v.rsplit('@', 1)[1]:
            raise ValueError('Enter a valid email address.')
        return v.strip().lower()
