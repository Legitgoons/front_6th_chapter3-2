import { http, HttpResponse } from 'msw';

import { events } from '../__mocks__/response/events.json' assert { type: 'json' };
import { Event } from '../types';

export const handlers = [
  http.get('/api/events', () => {
    return HttpResponse.json({ events });
  }),

  http.post('/api/events', async ({ request }) => {
    const newEvent = (await request.json()) as Event;
    newEvent.id = String(events.length + 1);
    return HttpResponse.json(newEvent, { status: 201 });
  }),

  http.put('/api/events/:id', async ({ params, request }) => {
    const { id } = params;
    const updatedEvent = (await request.json()) as Event;
    const index = events.findIndex((event) => event.id === id);

    if (index !== -1) {
      return HttpResponse.json({ ...events[index], ...updatedEvent });
    }

    return new HttpResponse(null, { status: 404 });
  }),

  http.delete('/api/events/:id', ({ params }) => {
    const { id } = params;
    const index = events.findIndex((event) => event.id === id);

    if (index !== -1) {
      return new HttpResponse(null, { status: 204 });
    }

    return new HttpResponse(null, { status: 404 });
  }),

  // 반복 일정 생성
  http.post('/api/events-list', async ({ request }) => {
    const { events: newEvents } = (await request.json()) as { events: Event[] };
    const repeatId = Math.random().toString(36).substr(2, 9);

    const createdEvents = newEvents.map((event, index) => ({
      ...event,
      id: String(events.length + index + 1),
      repeat: {
        ...event.repeat,
        id: event.repeat.type !== 'none' ? repeatId : undefined,
      },
    }));

    return HttpResponse.json(createdEvents, { status: 201 });
  }),

  // 반복 일정 수정
  http.put('/api/events-list', async ({ request }) => {
    const { events: eventsToUpdate } = (await request.json()) as { events: Event[] };

    const updatedEvents = eventsToUpdate.map((eventUpdate) => {
      const index = events.findIndex((event) => event.id === eventUpdate.id);
      if (index !== -1) {
        return { ...events[index], ...eventUpdate };
      }
      return eventUpdate;
    });

    return HttpResponse.json(updatedEvents);
  }),

  // 반복 일정 삭제
  http.delete('/api/events-list', async ({ request }) => {
    const { eventIds } = (await request.json()) as { eventIds: string[] };
    const exists = events.some((event) => eventIds.find((id) => event.id === id));

    if (!exists) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),
];
