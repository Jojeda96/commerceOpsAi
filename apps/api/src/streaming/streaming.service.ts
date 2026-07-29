import { Injectable, Logger } from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  InvestigationEvent,
  InvestigationEventType,
} from '@commerce-ops/shared-types';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly eventSubject = new ReplaySubject<InvestigationEvent>(50);

  emit(
    investigationId: string,
    type: InvestigationEventType,
    payload: Record<string, unknown>,
  ) {
    const event: InvestigationEvent = {
      type,
      investigationId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.logger.log(`[SSE Emit] [${investigationId}] ${type}`);
    this.eventSubject.next(event);
  }

  getStream(investigationId: string): Observable<{ data: InvestigationEvent }> {
    return this.eventSubject.asObservable().pipe(
      filter((event) => event.investigationId === investigationId),
      map((event) => ({ data: event })),
    );
  }
}
