import { Injectable } from '@nestjs/common'
import { Subject } from 'rxjs'
import type { Observable } from 'rxjs'
import type { IMessagePayload } from './messages.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type HubEvent =
  | { type: 'message', clientId: string, message: IMessagePayload }
  | { type: 'read', clientId: string, side: 'client' | 'staff' }

@Injectable()
export class MessagesHub {
  private readonly subject = new Subject<HubEvent>()

  emit(event: HubEvent): void {
    this.subject.next(event)
  }

  get events(): Observable<HubEvent> {
    return this.subject.asObservable()
  }
}
