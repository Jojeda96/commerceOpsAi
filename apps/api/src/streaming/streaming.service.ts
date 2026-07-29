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
  private readonly streamsMap = new Map<string, ReplaySubject<InvestigationEvent>>();

  private getOrCreateSubject(investigationId: string): ReplaySubject<InvestigationEvent> {
    if (!this.streamsMap.has(investigationId)) {
      this.streamsMap.set(investigationId, new ReplaySubject<InvestigationEvent>(100));
    }
    return this.streamsMap.get(investigationId)!;
  }

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
    const subject = this.getOrCreateSubject(investigationId);
    subject.next(event);
  }

  getStream(investigationId: string): Observable<{ data: InvestigationEvent }> {
    const subject = this.getOrCreateSubject(investigationId);
    return subject.asObservable().pipe(
      filter((event) => event.investigationId === investigationId),
      map((event) => ({ data: event })),
    );
  }
}
