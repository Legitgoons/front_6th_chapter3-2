import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';

import {
  setupMockHandlerCreation,
  setupMockHandlerDeletion,
  setupMockHandlerUpdating,
  setupMockHandlerRepeating,
} from '../__mocks__/handlersUtils';
import App from '../App';
import { server } from '../setupTests';
import { Event, RepeatType } from '../types';

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

  await user.click(screen.getByRole('button', { name: /일정 추가/ }));
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

    const eventList = within(screen.getByLabelText('일정 목록'));
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

    await user.click(screen.getByRole('button', { name: /일정 추가/ }));

    const eventList = within(screen.getByLabelText('일정 목록'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('회의 내용 변경')).toBeInTheDocument();
  });

  it('일정을 삭제하고 더 이상 조회되지 않는지 확인한다', async () => {
    setupMockHandlerDeletion();

    const { user } = setup(<App />);
    const eventList = within(screen.getByLabelText('일정 목록'));
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

    const eventList = within(screen.getByLabelText('일정 목록'));
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

    const eventList = within(screen.getByLabelText('일정 목록'));
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

    const eventList = within(screen.getByLabelText('일정 목록'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it("'팀 회의'를 검색하면 해당 제목을 가진 일정이 리스트에 노출된다", async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');

    const eventList = within(screen.getByLabelText('일정 목록'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
  });

  it('검색어를 지우면 모든 일정이 다시 표시되어야 한다', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');
    await user.clear(searchInput);

    const eventList = within(screen.getByLabelText('일정 목록'));
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

    await user.click(screen.getByRole('button', { name: /일정 추가/ }));

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

      // 반복 유형이 이미 렌더링되어 있는지 확인
      expect(screen.getByLabelText('반복 유형')).toBeInTheDocument();

      // 반복 유형 드롭다운 열기
      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));

      // 모든 반복 유형 옵션이 존재하는지 확인
      expect(screen.getByRole('option', { name: 'daily-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'weekly-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'monthly-option' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'yearly-option' })).toBeInTheDocument();

      // 매주 선택
      await user.click(screen.getByRole('option', { name: 'weekly-option' }));

      // 선택된 값이 표시되는지 확인
      expect(screen.getByDisplayValue('weekly')).toBeInTheDocument();
    });

    it('31일에 매월 반복을 선택하면 매월 31일에만 생성된다', async () => {
      setupMockHandlerRepeating();
      vi.setSystemTime(new Date('2025-01-31'));

      const { user } = setup(<App />);

      await saveRepeatingSchedule(user, {
        title: '월말 회의',
        date: '2025-01-31',
        startTime: '14:00',
        endTime: '15:00',
        description: '월말 정산 회의',
        location: '회의실 A',
        category: '업무',
        repeat: { type: 'monthly', interval: 1, endDate: '2025-06-30' },
        repeatType: 'monthly',
        repeatEndDate: '2025-06-30',
      });

      const eventList = within(screen.getByLabelText('일정 목록'));
      expect(eventList.getByText('월말 회의')).toBeInTheDocument();

      // 반복 일정 정보가 제대로 표시되는지 확인
      expect(eventList.getByText('2025-01-31')).toBeInTheDocument();

      // 반복 정보가 표시되는지 확인 (월마다 반복)
      expect(eventList.getByText(/반복:/)).toBeInTheDocument();
      expect(eventList.getByText(/월마다/)).toBeInTheDocument();
      expect(eventList.getByText(/종료: 2025-06-30/)).toBeInTheDocument();
    });

    it('윤년 2월 29일에 매년 반복을 선택하면 2월 29일에만 생성된다', async () => {
      setupMockHandlerRepeating();
      vi.setSystemTime(new Date('2024-02-29')); // 윤년

      const { user } = setup(<App />);

      await saveRepeatingSchedule(user, {
        title: '윤년 기념일',
        date: '2024-02-29',
        startTime: '10:00',
        endTime: '11:00',
        description: '4년에 한 번 오는 날',
        location: '특별한 장소',
        category: '개인',
        repeat: { type: 'yearly', interval: 1, endDate: '2030-03-01' },
        repeatType: 'yearly',
        repeatEndDate: '2030-03-01',
      });

      const eventList = within(screen.getByLabelText('일정 목록'));
      expect(eventList.getByText('윤년 기념일')).toBeInTheDocument();

      // 반복 일정 정보가 제대로 표시되는지 확인
      expect(eventList.getByText('2024-02-29')).toBeInTheDocument();

      // 반복 정보가 표시되는지 확인 (매년 반복)
      expect(eventList.getByText(/반복:/)).toBeInTheDocument();
      expect(eventList.getByText(/년마다/)).toBeInTheDocument();
      expect(eventList.getByText(/종료: 2030-03-01/)).toBeInTheDocument();
    });
  });

  describe('2. 반복 일정 표시', () => {
    it('캘린더 뷰에서 반복 일정은 아이콘으로 표시된다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await saveRepeatingSchedule(user, {
        title: '일일 스탠드업',
        date: '2025-10-15',
        startTime: '09:00',
        endTime: '09:30',
        description: '매일 진행되는 스탠드업 미팅',
        location: '회의실 B',
        category: '업무',
        repeat: { type: 'daily', interval: 1 },
        repeatType: 'daily',
      });

      const eventList = within(screen.getByLabelText('일정 목록'));

      // 반복 아이콘이 표시되는지 확인 (반복 일정에 존재)
      const repeatIcons = eventList.queryAllByLabelText('반복 일정');
      expect(repeatIcons.length).toBeGreaterThan(0);

      // 일일 스탠드업 이벤트가 생성되었는지 확인
      expect(eventList.getAllByText('일일 스탠드업').length).toBeGreaterThan(0);
    });
  });

  describe('3. 반복 종료', () => {
    it('반복 종료 조건으로 특정 날짜를 지정할 수 있다', async () => {
      setupMockHandlerRepeating();

      const { user } = setup(<App />);

      await user.click(screen.getAllByText('일정 추가')[0]);

      await user.type(screen.getByLabelText('제목'), '제한된 반복 일정');
      await user.type(screen.getByLabelText('날짜'), '2025-10-15');
      await user.type(screen.getByLabelText('시작 시간'), '14:00');
      await user.type(screen.getByLabelText('종료 시간'), '15:00');

      // 반복 설정
      const repeatCheckbox: HTMLInputElement = screen.getByRole('checkbox', {
        name: /반복 일정/,
      });
      if (!repeatCheckbox.checked) {
        await user.click(repeatCheckbox);
      }

      await user.click(screen.getByLabelText('반복 유형'));
      await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'daily-option' }));

      // 반복 종료일 설정
      const endDateInput = document.getElementById('repeat-end-date') as HTMLInputElement;
      await user.type(endDateInput, '2025-10-30');

      await user.click(screen.getByRole('button', { name: /일정 추가/ }));

      // 반복 종료일이 이벤트 리스트에 표시되는지 확인
      const eventList = within(screen.getByLabelText('일정 목록'));
      expect(eventList.getAllByText(/종료: 2025-10-30/).length).toBeGreaterThan(0);
    });

    it('반복 종료일이 2025-10-30이면, 그 이후 일정은 생성되지 않는다', async () => {
      setupMockHandlerRepeating();
      vi.setSystemTime(new Date('2025-10-15'));

      const { user } = setup(<App />);

      await saveRepeatingSchedule(user, {
        title: '제한된 일일 회의',
        date: '2025-10-15',
        startTime: '09:00',
        endTime: '10:00',
        description: '10월 30일까지만 진행',
        location: '회의실 A',
        category: '업무',
        repeat: { type: 'daily', interval: 1, endDate: '2025-10-30' },
        repeatType: 'daily',
        repeatEndDate: '2025-10-30',
      });

      const eventList = within(screen.getByLabelText('일정 목록'));

      // 반복 일정이 생성되었는지 확인
      expect(eventList.getAllByText('제한된 일일 회의').length).toBeGreaterThan(0);

      // 반복 종료일 정보가 표시되는지 확인
      expect(eventList.getAllByText(/종료: 2025-10-30/).length).toBeGreaterThan(0);
    });
  });

  describe('4. 반복 일정 단일 수정', () => {
    it('반복 일정을 수정하면 해당 일정은 단일 일정으로 변경된다', async () => {
      setupMockHandlerUpdating();
      vi.setSystemTime(new Date('2025-10-15'));

      const { user } = setup(<App />);

      // 데이터 로드 대기
      await waitFor(() => {
        expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
      });

      // 기존 회의 이벤트 아이템 찾기
      const eventList = within(screen.getByLabelText('일정 목록'));
      const eventItem = eventList.getByText('기존 회의').closest('[role="article"]');

      // 해당 이벤트의 수정 버튼 클릭
      const editButton = within(eventItem as HTMLElement).getByLabelText('Edit event');
      await user.click(editButton);

      // 제목 수정
      await user.clear(screen.getByLabelText('제목'));
      await user.type(screen.getByLabelText('제목'), '수정된 단일 일정');

      await user.click(screen.getByRole('button', { name: /일정 수정/ }));

      const updatedEventItem = eventList.getByText('수정된 단일 일정').closest('[role="article"]');

      // 반복 아이콘이 사라졌는지 확인
      expect(
        within(updatedEventItem as HTMLElement).queryByLabelText('반복 일정')
      ).not.toBeInTheDocument();
    });

    it('수정된 일정에서는 반복 일정 아이콘이 사라진다', async () => {
      setupMockHandlerUpdating();
      vi.setSystemTime(new Date('2025-10-15'));

      const { user } = setup(<App />);

      // 데이터 로드 대기
      await waitFor(() => {
        expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
      });

      // 수정 전에는 반복 아이콘이 있어야 함
      const eventList = within(screen.getByLabelText('일정 목록'));
      const originalEventItem = eventList.getByText('기존 회의').closest('[role="article"]');
      expect(
        within(originalEventItem as HTMLElement).getByLabelText('반복 일정')
      ).toBeInTheDocument();

      // 해당 이벤트의 수정 버튼 클릭
      const editButton = within(originalEventItem as HTMLElement).getByLabelText('Edit event');
      await user.click(editButton);

      await user.clear(screen.getByLabelText('설명'));
      await user.type(screen.getByLabelText('설명'), '수정된 설명');

      await user.click(screen.getByRole('button', { name: /일정 수정/ }));

      // 수정 후에는 반복 아이콘이 사라져야 함
      const updatedEventItem = eventList.getByText('기존 회의').closest('[role="article"]');
      expect(
        within(updatedEventItem as HTMLElement).queryByLabelText('반복 일정')
      ).not.toBeInTheDocument();
    });
  });

  describe('5. 반복 일정 단일 삭제', () => {
    it('반복 일정을 삭제하면 해당 일정만 삭제된다', async () => {
      setupMockHandlerDeletion();
      vi.setSystemTime(new Date('2025-10-15'));

      const { user } = setup(<App />);

      // 데이터 로드 대기
      await waitFor(() => {
        expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
      });

      const eventList = within(screen.getByLabelText('일정 목록'));

      // 삭제 전에는 반복 일정이 표시되어야 함
      expect(eventList.getAllByText('반복 일정').length).toBeGreaterThan(0);

      // 첫 번째 반복 일정의 삭제 버튼 찾기
      const firstEventItem = eventList.getAllByText('반복 일정')[0].closest('[role="article"]');
      const deleteButton = within(firstEventItem as HTMLElement).getByLabelText('Delete event');

      // 삭제 전 이벤트 개수 확인
      const beforeDeleteCount = eventList.getAllByText('반복 일정').length;

      await user.click(deleteButton);

      // 해당 인스턴스만 삭제되어 개수가 줄어들어야 함
      await waitFor(() => {
        const afterDeleteCount = eventList.queryAllByText('반복 일정').length;
        expect(afterDeleteCount).toBe(beforeDeleteCount - 1);
      });
    });
  });
});

const saveRepeatingSchedule = async (
  user: UserEvent,
  form: Omit<Event, 'id' | 'notificationTime'> & {
    repeatType: RepeatType;
    repeatInterval?: number;
    repeatEndDate?: string;
  }
) => {
  const {
    title,
    date,
    startTime,
    endTime,
    location,
    description,
    category,
    repeatType,
    repeatInterval = 1,
    repeatEndDate,
  } = form;

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

  // 반복 설정
  if (repeatType !== 'none') {
    const repeatCheckbox: HTMLInputElement = screen.getByRole('checkbox', {
      name: /반복 일정/,
    });
    if (!repeatCheckbox.checked) {
      await user.click(repeatCheckbox);
    }

    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(within(screen.getByLabelText('반복 유형')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: `${repeatType}-option` }));

    if (repeatInterval > 1) {
      await user.clear(screen.getByLabelText('반복 간격'));
      await user.type(screen.getByLabelText('반복 간격'), repeatInterval.toString());
    }

    if (repeatEndDate) {
      const endDateInput = document.getElementById('repeat-end-date') as HTMLInputElement;
      await user.type(endDateInput, repeatEndDate);
    }
  }

  await user.click(screen.getByRole('button', { name: /일정 추가/ }));
};
