import { Injectable } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.service'
import { FollowUpActionsService } from '../follow-up-actions/follow-up-actions.service'

@Injectable()
export class WeekViewService {
  constructor(private readonly actionsService: FollowUpActionsService) {}

  getWeekView(user: AuthUser, start: string, end: string) {
    return this.actionsService.week(user, start, end)
  }
}
