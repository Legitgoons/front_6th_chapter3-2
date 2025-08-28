import { http, HttpResponse } from 'msw';

import { server } from '../setupTests';
import { Event } from '../types';

// ! Hard 여기 제공 안함
export const setupMockHandlerCreation = (initEvents = [] as Event[]) => {
  const mockEvents: Event[] = [...initEvents];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events', async ({ request }) => {
      const newEvent = (await request.json()) as Event;
      newEvent.id = String(mockEvents.length + 1); // 간단한 ID 생성
      mockEvents.push(newEvent);
      return HttpResponse.json(newEvent, { status: 201 });
    })
  );
};

export const setupMockHandlerUpdating = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '기존 회의',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '기존 팀 미팅',
      location: '회의실 B',
      category: '업무',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
    {
      id: '2',
      title: '기존 회의2',
      date: '2025-10-15',
      startTime: '11:00',
      endTime: '12:00',
      description: '기존 팀 미팅 2',
      location: '회의실 C',
      category: '업무',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.put('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const updatedEvent = (await request.json()) as Event;
      const index = mockEvents.findIndex((event) => event.id === id);

      mockEvents[index] = { ...mockEvents[index], ...updatedEvent };
      return HttpResponse.json(mockEvents[index]);
    })
  );
};

export const setupMockHandlerDeletion = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '삭제할 이벤트',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '삭제할 이벤트입니다',
      location: '어딘가',
      category: '기타',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      mockEvents.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    })
  );
};

// 반복 일정 생성을 위한 핸들러
export const setupMockHandlerRepeating = () => {
  const mockEvents: Event[] = [];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events-list', async ({ request }) => {
      const { events } = (await request.json()) as { events: Event[] };
      const repeatId = Math.random().toString(36).substr(2, 9);

      const newEvents = events.map((event, index) => ({
        ...event,
        id: String(mockEvents.length + index + 1),
        repeat: {
          ...event.repeat,
          id: event.repeat.type !== 'none' ? repeatId : undefined,
        },
      }));

      mockEvents.push(...newEvents);
      return HttpResponse.json(newEvents, { status: 201 });
    })
  );
};

// 반복 일정 수정을 위한 핸들러
export const setupMockHandlerRepeatingUpdate = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '매주 회의',
      date: '2025-10-06',
      startTime: '14:00',
      endTime: '15:00',
      description: '매주 월요일 회의',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, id: 'repeat-123' },
      notificationTime: 10,
    },
    {
      id: '2',
      title: '매주 회의',
      date: '2025-10-13',
      startTime: '14:00',
      endTime: '15:00',
      description: '매주 월요일 회의',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, id: 'repeat-123' },
      notificationTime: 10,
    },
    {
      id: '3',
      title: '매주 회의',
      date: '2025-10-20',
      startTime: '14:00',
      endTime: '15:00',
      description: '매주 월요일 회의',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, id: 'repeat-123' },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.put('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const updatedEvent = (await request.json()) as Event;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index !== -1) {
        // 수정 시 반복 일정을 단일 일정으로 변경
        mockEvents[index] = {
          ...mockEvents[index],
          ...updatedEvent,
          repeat: { type: 'none', interval: 0 }, // 단일 일정으로 변경
        };
        return HttpResponse.json(mockEvents[index]);
      }

      return new HttpResponse(null, { status: 404 });
    })
  );
};

// 반복 일정 삭제를 위한 핸들러
export const setupMockHandlerRepeatingDeletion = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '매주 회의',
      date: '2025-10-06',
      startTime: '14:00',
      endTime: '15:00',
      description: '매주 월요일 회의',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, id: 'repeat-456' },
      notificationTime: 10,
    },
    {
      id: '2',
      title: '매주 회의',
      date: '2025-10-13',
      startTime: '14:00',
      endTime: '15:00',
      description: '매주 월요일 회의',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, id: 'repeat-456' },
      notificationTime: 10,
    },
    {
      id: '3',
      title: '매주 회의',
      date: '2025-10-20',
      startTime: '14:00',
      endTime: '15:00',
      description: '매주 월요일 회의',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'weekly', interval: 1, id: 'repeat-456' },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index !== -1) {
        mockEvents.splice(index, 1); // 해당 일정만 삭제
        return new HttpResponse(null, { status: 204 });
      }

      return new HttpResponse(null, { status: 404 });
    })
  );
};
