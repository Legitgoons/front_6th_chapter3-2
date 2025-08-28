import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, within, act } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';

import {
  setupMockHandlerCreation,
  setupMockHandlerDeletion,
  setupMockHandlerUpdating,
  setupMockHandlerRepeating,
  setupMockHandlerRepeatingUpdate,
  setupMockHandlerRepeatingDeletion,
} from '../__mocks__/handlersUtils';
import App from '../App';
import { server } from '../setupTests';
import { Event } from '../types';

const theme = createTheme();

// ! Hard 여기 제공 안함
const setup = (element: ReactElement) => {
  const user = userEvent.setup();

  return {
    ...render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>{element}</SnackbarProvider>
      </ThemeProvider>
    ),
    user,
  };
};

// ! Hard 여기 제공 안함
const saveSchedule = async (
  user: UserEvent,
  form: Omit<Event, 'id' | 'notificationTime' | 'repeat'>
) => {
  const { title, date, startTime, endTime, location, description, category } = form;

  await user.click(screen.getAllByText('일정 추가')[0]);

  await user.type(screen.getByLabelText('제목'), title);
  await user.type(screen.getByLabelText('날짜'), date);
  await user.type(screen.getByLabelText('시작 시간'), startTime);
  await user.type(screen.getByLabelText('종료 시간'), endTime);
  await user.type(screen.getByLabelText('설명'), description);
  await user.type(screen.getByLabelText('위치'), location);
  await user.click(screen.getByLabelText('카테고리'));
  await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: `${category}-option` }));

  await user.click(screen.getByTestId('event-submit-button'));
};

describe('일정 CRUD 및 기본 기능', () => {
  it('입력한 새로운 일정 정보에 맞춰 모든 필드가 이벤트 리스트에 정확히 저장된다.', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2025-10-15',
      startTime: '14:00',
      endTime: '15:00',
      description: '프로젝트 진행 상황 논의',
      location: '회의실 A',
      category: '업무',
    });

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('새 회의')).toBeInTheDocument();
    expect(eventList.getByText('2025-10-15')).toBeInTheDocument();
    expect(eventList.getByText('14:00 - 15:00')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 진행 상황 논의')).toBeInTheDocument();
    expect(eventList.getByText('회의실 A')).toBeInTheDocument();
    expect(eventList.getByText('카테고리: 업무')).toBeInTheDocument();
  });

  it('기존 일정의 세부 정보를 수정하고 변경사항이 정확히 반영된다', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    await user.click(await screen.findByLabelText('Edit event'));

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('회의 내용 변경')).toBeInTheDocument();
  });

  it('일정을 삭제하고 더 이상 조회되지 않는지 확인한다', async () => {
    setupMockHandlerDeletion();

    const { user } = setup(<App />);
    const eventList = within(screen.getByTestId('event-list'));
    expect(await eventList.findByText('삭제할 이벤트')).toBeInTheDocument();

    // 삭제 버튼 클릭
    const allDeleteButton = await screen.findAllByLabelText('Delete event');
    await user.click(allDeleteButton[0]);

    expect(eventList.queryByText('삭제할 이벤트')).not.toBeInTheDocument();
  });
});

describe('일정 뷰', () => {
  it('주별 뷰를 선택 후 해당 주에 일정이 없으면, 일정이 표시되지 않는다.', async () => {
    // ! 현재 시스템 시간 2025-10-01
    const { user } = setup(<App />);

    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('주별 뷰 선택 후 해당 일자에 일정이 존재한다면 해당 일정이 정확히 표시된다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번주 팀 회의',
      date: '2025-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번주 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    const weekView = within(screen.getByTestId('week-view'));
    expect(weekView.getByText('이번주 팀 회의')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 없으면, 일정이 표시되지 않아야 한다.', async () => {
    vi.setSystemTime(new Date('2025-01-01'));

    setup(<App />);

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 정확히 표시되는지 확인한다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번달 팀 회의',
      date: '2025-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번달 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    const monthView = within(screen.getByTestId('month-view'));
    expect(monthView.getByText('이번달 팀 회의')).toBeInTheDocument();
  });

  it('달력에 1월 1일(신정)이 공휴일로 표시되는지 확인한다', async () => {
    vi.setSystemTime(new Date('2025-01-01'));
    setup(<App />);

    const monthView = screen.getByTestId('month-view');

    // 1월 1일 셀 확인
    const januaryFirstCell = within(monthView).getByText('1').closest('td')!;
    expect(within(januaryFirstCell).getByText('신정')).toBeInTheDocument();
  });
});

describe('검색 기능', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/events', () => {
        return HttpResponse.json({
          events: [
            {
              id: 1,
              title: '팀 회의',
              date: '2025-10-15',
              startTime: '09:00',
              endTime: '10:00',
              description: '주간 팀 미팅',
              location: '회의실 A',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
            {
              id: 2,
              title: '프로젝트 계획',
              date: '2025-10-16',
              startTime: '14:00',
              endTime: '15:00',
              description: '새 프로젝트 계획 수립',
              location: '회의실 B',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
          ],
        });
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('검색 결과가 없으면, "검색 결과가 없습니다."가 표시되어야 한다.', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '존재하지 않는 일정');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it("'팀 회의'를 검색하면 해당 제목을 가진 일정이 리스트에 노출된다", async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
  });

  it('검색어를 지우면 모든 일정이 다시 표시되어야 한다', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');
    await user.clear(searchInput);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 계획')).toBeInTheDocument();
  });
});

describe('일정 충돌', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('겹치는 시간에 새 일정을 추가할 때 경고가 표시된다', async () => {
    setupMockHandlerCreation([
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
    ]);

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2025-10-15',
      startTime: '09:30',
      endTime: '10:30',
      description: '설명',
      location: '회의실 A',
      category: '업무',
    });

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2025-10-15 09:00-10:00)')).toBeInTheDocument();
  });

  it('기존 일정의 시간을 수정하여 충돌이 발생하면 경고가 노출된다', async () => {
    setupMockHandlerUpdating();

    const { user } = setup(<App />);

    const editButton = (await screen.findAllByLabelText('Edit event'))[1];
    await user.click(editButton);

    // 시간 수정하여 다른 일정과 충돌 발생
    await user.clear(screen.getByLabelText('시작 시간'));
    await user.type(screen.getByLabelText('시작 시간'), '08:30');
    await user.clear(screen.getByLabelText('종료 시간'));
    await user.type(screen.getByLabelText('종료 시간'), '10:30');

    await user.click(screen.getByTestId('event-submit-button'));

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2025-10-15 09:00-10:00)')).toBeInTheDocument();
  });
});

it('notificationTime을 10으로 하면 지정 시간 10분 전 알람 텍스트가 노출된다', async () => {
  vi.setSystemTime(new Date('2025-10-15 08:49:59'));

  setup(<App />);

  // ! 일정 로딩 완료 후 테스트
  await screen.findByText('일정 로딩 완료!');

  expect(screen.queryByText('10분 후 기존 회의 일정이 시작됩니다.')).not.toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(screen.getByText('10분 후 기존 회의 일정이 시작됩니다.')).toBeInTheDocument();
});

describe('반복 일정 기능', () => {
  describe('1. 반복 유형 선택', () => {
    it('일정 생성/수정 시 매일, 매주, 매월, 매년 반복 유형을 선택할 수 있다', async () => {
      setupMockHandlerCreation();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      // 반복 유형 선택 확인
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));

      expect(screen.getByRole('option', { name: 'none-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'daily-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'weekly-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'monthly-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'yearly-option' })).toBeInTheDocument();
    });

    it('31일에 매월 반복을 선택하면 매월 31일에만 생성된다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      await user.type(screen.getByLabelText('제목'), '매월 31일 회의');
      await user.type(screen.getByLabelText('날짜'), '2025-01-31');
      await user.type(screen.getByLabelText('시작 시간'), '09:00');
      await user.type(screen.getByLabelText('종료 시간'), '10:00');
      await user.type(screen.getByLabelText('설명'), '매월 마지막 날 회의');
      await user.type(screen.getByLabelText('위치'), '회의실 A');
      await user.click(screen.getByLabelText('카테고리'));
      await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: '업무-option' }));

      // 반복 설정
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'monthly-option' }));

      await user.type(screen.getByLabelText('반복 종료일'), '2025-04-30');

      await user.click(screen.getByTestId('event-submit-button'));

      // 3월은 31일이 있지만 2월, 4월은 31일이 없으므로 1월과 3월에만 생성되어야 함
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('2025-01-31')).toBeInTheDocument();
      expect(eventList.getByText('2025-03-31')).toBeInTheDocument();
      expect(eventList.queryByText('2025-02-31')).not.toBeInTheDocument();
      expect(eventList.queryByText('2025-04-31')).not.toBeInTheDocument();
    });

    it('윤년 2월 29일에 매년 반복을 선택하면 2월 29일에만 생성된다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      await user.type(screen.getByLabelText('제목'), '윤년 기념일');
      await user.type(screen.getByLabelText('날짜'), '2024-02-29');
      await user.type(screen.getByLabelText('시작 시간'), '09:00');
      await user.type(screen.getByLabelText('종료 시간'), '10:00');
      await user.type(screen.getByLabelText('설명'), '윤년에만 있는 날');
      await user.type(screen.getByLabelText('위치'), '어딘가');
      await user.click(screen.getByLabelText('카테고리'));
      await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: '개인-option' }));

      // 반복 설정
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'yearly-option' }));

      await user.type(screen.getByLabelText('반복 종료일'), '2028-03-01');

      await user.click(screen.getByTestId('event-submit-button'));

      // 2024년과 2028년은 윤년이므로 2월 29일이 있지만, 2025, 2026, 2027년은 평년이므로 2월 29일이 없음
      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('2024-02-29')).toBeInTheDocument();
      expect(eventList.getByText('2028-02-29')).toBeInTheDocument();
      expect(eventList.queryByText('2025-02-29')).not.toBeInTheDocument();
      expect(eventList.queryByText('2026-02-29')).not.toBeInTheDocument();
      expect(eventList.queryByText('2027-02-29')).not.toBeInTheDocument();
    });
  });

  describe('2. 반복 일정 표시', () => {
    it('캘린더 뷰에서 반복 일정은 아이콘으로 표시된다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      await user.type(screen.getByLabelText('제목'), '매주 회의');
      await user.type(screen.getByLabelText('날짜'), '2025-10-06');
      await user.type(screen.getByLabelText('시작 시간'), '14:00');
      await user.type(screen.getByLabelText('종료 시간'), '15:00');
      await user.type(screen.getByLabelText('설명'), '매주 월요일 회의');
      await user.type(screen.getByLabelText('위치'), '회의실 B');
      await user.click(screen.getByLabelText('카테고리'));
      await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: '업무-option' }));

      // 반복 설정
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'weekly-option' }));

      await user.type(screen.getByLabelText('반복 종료일'), '2025-10-20');

      await user.click(screen.getByTestId('event-submit-button'));

      // 반복 아이콘이 표시되는지 확인
      expect(screen.getByTestId('repeat-icon')).toBeInTheDocument();
    });
  });

  describe('3. 반복 종료', () => {
    it('반복 종료 조건으로 특정 날짜를 지정할 수 있다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      await user.type(screen.getByLabelText('제목'), '매일 운동');
      await user.type(screen.getByLabelText('날짜'), '2025-10-01');
      await user.type(screen.getByLabelText('시작 시간'), '07:00');
      await user.type(screen.getByLabelText('종료 시간'), '08:00');
      await user.type(screen.getByLabelText('설명'), '매일 아침 운동');
      await user.type(screen.getByLabelText('위치'), '헬스장');
      await user.click(screen.getByLabelText('카테고리'));
      await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: '개인-option' }));

      // 반복 설정
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'daily-option' }));

      // 반복 종료일 필드가 표시되는지 확인
      expect(screen.getByLabelText('반복 종료일')).toBeInTheDocument();

      await user.type(screen.getByLabelText('반복 종료일'), '2025-10-05');

      await user.click(screen.getByTestId('event-submit-button'));

      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('2025-10-01')).toBeInTheDocument();
      expect(eventList.getByText('2025-10-05')).toBeInTheDocument();
    });

    it('반복 종료일이 2025-10-30이면, 그 이후 일정은 생성되지 않는다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      await user.type(screen.getByLabelText('제목'), '매주 회의');
      await user.type(screen.getByLabelText('날짜'), '2025-10-27');
      await user.type(screen.getByLabelText('시작 시간'), '10:00');
      await user.type(screen.getByLabelText('종료 시간'), '11:00');
      await user.type(screen.getByLabelText('설명'), '매주 월요일 회의');
      await user.type(screen.getByLabelText('위치'), '회의실 C');
      await user.click(screen.getByLabelText('카테고리'));
      await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: '업무-option' }));

      // 반복 설정
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'weekly-option' }));

      await user.type(screen.getByLabelText('반복 종료일'), '2025-10-30');

      await user.click(screen.getByTestId('event-submit-button'));

      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('2025-10-27')).toBeInTheDocument();
      // 2025-11-03은 반복 종료일 이후이므로 생성되지 않아야 함
      expect(eventList.queryByText('2025-11-03')).not.toBeInTheDocument();
    });
  });

  describe('4. 반복 일정 단일 수정', () => {
    it('반복 일정을 수정하면 해당 일정은 단일 일정으로 변경된다', async () => {
      setupMockHandlerRepeatingUpdate();

      const { user } = setup(<App />);

      // 반복 일정 중 하나를 선택해서 수정
      await user.click((await screen.findAllByLabelText('Edit event'))[0]);

      await user.clear(screen.getByLabelText('제목'));
      await user.type(screen.getByLabelText('제목'), '수정된 개별 회의');

      await user.click(screen.getByTestId('event-submit-button'));

      const eventList = within(screen.getByTestId('event-list'));
      expect(eventList.getByText('수정된 개별 회의')).toBeInTheDocument();
    });

    it('수정된 일정에서는 반복 일정 아이콘이 사라진다', async () => {
      setupMockHandlerRepeatingUpdate();

      const { user } = setup(<App />);

      // 반복 일정 중 하나를 선택해서 수정
      await user.click((await screen.findAllByLabelText('Edit event'))[0]);

      await user.clear(screen.getByLabelText('제목'));
      await user.type(screen.getByLabelText('제목'), '수정된 개별 회의');

      await user.click(screen.getByTestId('event-submit-button'));

      // 수정된 일정에 대해서는 반복 아이콘이 사라져야 함
      const eventItems = screen.getAllByTestId(/event-item-/);
      const modifiedEvent = eventItems.find((item) => within(item).queryByText('수정된 개별 회의'));

      expect(within(modifiedEvent!).queryByTestId('repeat-icon')).not.toBeInTheDocument();
    });
  });

  describe('5. 반복 일정 단일 삭제', () => {
    it('반복 일정을 삭제하면 해당 일정만 삭제된다', async () => {
      setupMockHandlerRepeatingDeletion();

      const { user } = setup(<App />);

      const eventList = within(screen.getByTestId('event-list'));
      expect(await eventList.findByText('2025-10-06')).toBeInTheDocument();
      expect(await eventList.findByText('2025-10-13')).toBeInTheDocument();
      expect(await eventList.findByText('2025-10-20')).toBeInTheDocument();

      // 첫 번째 반복 일정만 삭제
      const deleteButtons = await screen.findAllByLabelText('Delete event');
      await user.click(deleteButtons[0]);

      // 삭제된 일정은 보이지 않아야 하고, 나머지는 그대로 있어야 함
      expect(eventList.queryByText('2025-10-06')).not.toBeInTheDocument();
      expect(eventList.getByText('2025-10-13')).toBeInTheDocument();
      expect(eventList.getByText('2025-10-20')).toBeInTheDocument();
    });
  });
});
