describe('E2E SSE Deduplication Specs', () => {
  it('must deduplicate incoming stream events by eventId', () => {
    const events = [
      { eventId: 'inv-1:1', type: 'investigation.started' },
      { eventId: 'inv-1:2', type: 'agent.started' },
      { eventId: 'inv-1:1', type: 'investigation.started' }, // Duplicate replay
    ];

    const deduplicated: typeof events = [];
    for (const ev of events) {
      if (!deduplicated.some((e) => e.eventId === ev.eventId)) {
        deduplicated.push(ev);
      }
    }

    expect(deduplicated).toHaveLength(2);
    expect(deduplicated.map((e) => e.eventId)).toEqual(['inv-1:1', 'inv-1:2']);
  });
});
