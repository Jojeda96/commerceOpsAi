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
  private readonly streamsMap = new Map<
    string,
    ReplaySubject<InvestigationEvent>
  >();
  private readonly sequenceMap = new Map<string, number>();

  private getOrCreateSubject(
    investigationId: string,
  ): ReplaySubject<InvestigationEvent> {
    if (!this.streamsMap.has(investigationId)) {
      this.streamsMap.set(
        investigationId,
        new ReplaySubject<InvestigationEvent>(200),
      );
    }
    return this.streamsMap.get(investigationId)!;
  }

  emit(
    investigationId: string,
    type: InvestigationEventType,
    payload: Record<string, unknown>,
    iteration: number = 1,
  ) {
    const currentSeq = (this.sequenceMap.get(investigationId) || 0) + 1;
    this.sequenceMap.set(investigationId, currentSeq);

    const eventId = `${investigationId}:${currentSeq}`;
    const event: InvestigationEvent = {
      eventId,
      sequence: currentSeq,
      type,
      investigationId,
      iteration,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.logger.log(`[SSE Emit] [${eventId}] [${type}]`);
    const subject = this.getOrCreateSubject(investigationId);
    subject.next(event);
  }

  getStream(
    investigationId: string,
  ): Observable<{ id: string; data: InvestigationEvent }> {
    const subject = this.getOrCreateSubject(investigationId);
    return subject.asObservable().pipe(
      filter((event) => event.investigationId === investigationId),
      map((event) => ({ id: (event as any).eventId || `${investigationId}:0`, data: event })),
    );
  }

  closeStream(investigationId: string) {
    const subject = this.streamsMap.get(investigationId);
    if (subject) {
      setTimeout(() => {
        subject.complete();
        this.streamsMap.delete(investigationId);
        this.sequenceMap.delete(investigationId);
        this.logger.log(`[SSE Closed & Cleaned] [${investigationId}]`);
      }, 5000);
    }
  }
}
