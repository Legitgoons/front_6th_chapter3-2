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
      repeat: { type: 'daily', interval: 1 }, // 반복 일정으로 변경
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

      // 반복 일정을 수정하면 단일 일정으로 변경
      const updatedEventWithSingleRepeat = {
        ...mockEvents[index],
        ...updatedEvent,
        repeat: { type: 'none' as const, interval: 0 },
      };

      mockEvents[index] = updatedEventWithSingleRepeat;
      return HttpResponse.json(mockEvents[index]);
    })
  );
};

// 단일 이벤트 삭제 테스트용 핸들러
export const setupMockHandlerDeletion = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '삭제할 이벤트',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '삭제 테스트용 이벤트',
      location: '회의실 A',
      category: '업무',
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

      if (index !== -1) {
        mockEvents.splice(index, 1);
      }
      return new HttpResponse(null, { status: 204 });
    })
  );
};

// 반복 일정 단일 삭제 테스트용 핸들러
export const setupMockHandlerRepeatingDeletion = () => {
  // 삭제 테스트용으로 제한적인 반복 일정 인스턴스들만 생성 (5개)
  const mockEvents: Event[] = [
    {
      id: '1-1',
      title: '반복 일정',
      date: '2025-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '매일 반복되는 일정',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'daily', interval: 1 },
      notificationTime: 10,
    },
    {
      id: '1-2',
      title: '반복 일정',
      date: '2025-10-16',
      startTime: '09:00',
      endTime: '10:00',
      description: '매일 반복되는 일정',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'daily', interval: 1 },
      notificationTime: 10,
    },
    {
      id: '1-3',
      title: '반복 일정',
      date: '2025-10-17',
      startTime: '09:00',
      endTime: '10:00',
      description: '매일 반복되는 일정',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'daily', interval: 1 },
      notificationTime: 10,
    },
    {
      id: '1-4',
      title: '반복 일정',
      date: '2025-10-18',
      startTime: '09:00',
      endTime: '10:00',
      description: '매일 반복되는 일정',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'daily', interval: 1 },
      notificationTime: 10,
    },
    {
      id: '1-5',
      title: '반복 일정',
      date: '2025-10-19',
      startTime: '09:00',
      endTime: '10:00',
      description: '매일 반복되는 일정',
      location: '회의실 A',
      category: '업무',
      repeat: { type: 'daily', interval: 1 },
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
        mockEvents.splice(index, 1);
      }
      return new HttpResponse(null, { status: 204 });
    })
  );
};

// 반복 일정을 위한 mock handler
export const setupMockHandlerRepeating = () => {
  const mockEvents: Event[] = [];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events', async ({ request }) => {
      const newEvent = (await request.json()) as Event;
      newEvent.id = String(mockEvents.length + 1);

      // 반복 일정인 경우 반복 일정들을 생성
      if (newEvent.repeat.type !== 'none') {
        const repeatingEvents = generateRepeatingEvents(newEvent);
        mockEvents.push(...repeatingEvents);
      } else {
        mockEvents.push(newEvent);
      }

      return HttpResponse.json(newEvent, { status: 201 });
    })
  );
};

// 반복 일정 생성 헬퍼 함수
const generateRepeatingEvents = (baseEvent: Event): Event[] => {
  const events: Event[] = [];
  const startDate = new Date(baseEvent.date);
  const endDate = baseEvent.repeat.endDate
    ? new Date(baseEvent.repeat.endDate)
    : new Date('2025-10-30'); // 예제 특성상 2025-10-30까지만 생성

  let currentDate = new Date(startDate);
  let eventId = 1;

  while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split('T')[0];

    // 특수 케이스 처리: 31일 매월 반복, 윤년 2월 29일 매년 반복
    if (shouldSkipDate(baseEvent, currentDate)) {
      incrementDate(currentDate, baseEvent.repeat.type, baseEvent.repeat.interval);
      continue;
    }

    events.push({
      ...baseEvent,
      id: `${baseEvent.id}-${eventId}`,
      date: dateString,
    });

    eventId++;
    incrementDate(currentDate, baseEvent.repeat.type, baseEvent.repeat.interval);
  }

  return events;
};

// 날짜를 건너뛸지 결정하는 함수
const shouldSkipDate = (baseEvent: Event, currentDate: Date): boolean => {
  const baseDate = new Date(baseEvent.date);

  // 매월 반복에서 31일인 경우
  if (baseEvent.repeat.type === 'monthly' && baseDate.getDate() === 31) {
    return currentDate.getDate() !== 31;
  }

  // 매년 반복에서 2월 29일인 경우
  if (
    baseEvent.repeat.type === 'yearly' &&
    baseDate.getMonth() === 1 &&
    baseDate.getDate() === 29
  ) {
    return (
      !isLeapYear(currentDate.getFullYear()) ||
      currentDate.getMonth() !== 1 ||
      currentDate.getDate() !== 29
    );
  }

  return false;
};

// 윤년 체크 함수
const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

// 날짜 증가 함수
const incrementDate = (date: Date, repeatType: string, interval: number): void => {
  switch (repeatType) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7 * interval);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
  }
};
