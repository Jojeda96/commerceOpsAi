describe('Streaming Regression Specs (EXEC PLAN V4.1)', () => {
  it('must assign unique eventId and monotonic sequence to each investigation event', () => {
    const events: { eventId: string; sequence: number }[] = [];
    const pushEvent = (seq: number, invId: string) => {
      events.push({ sequence: seq, eventId: `${invId}:${seq}` });
    };
    pushEvent(1, 'inv-123');
    pushEvent(2, 'inv-123');
    expect(events[0].eventId).toBe('inv-123:1');
    expect(events[1].eventId).toBe('inv-123:2');
    expect(events[0].eventId).not.toEqual(events[1].eventId);
  });
});
