# Mock Handler 데이터 로딩 문제 해결

## 테스트 목표
반복 일정 수정 테스트에서 "기존 회의" 데이터가 올바르게 로드되어 테스트가 수행되도록 함

## 발생한 문제

### 문제 1: Unable to find an element with the text: 기존 회의
**에러 메시지:**
```
TestingLibraryElementError: Unable to find an element with the text: 기존 회의. 
This could be because the text is broken up by multiple elements. 
In this case, you can provide a function for your text matcher to make your matcher more flexible.
```

**원인:**
- Mock Handler가 설정되었지만 데이터가 실제로 렌더링되지 않음
- DOM에는 "검색 결과가 없습니다."만 표시됨
- 테스트가 데이터 로딩을 기다리지 않고 즉시 DOM 검색을 시도

**실제 DOM 상태:**
```html
<div aria-label="일정 목록">
  <div class="MuiFormControl-root MuiFormControl-fullWidth">
    <label for="search">일정 검색</label>
    <!-- 검색 입력 필드 -->
  </div>
  <p class="MuiTypography-root MuiTypography-body1">
    검색 결과가 없습니다.
  </p>
</div>
```

## 해결 방법

### 1단계: 적절한 날짜 설정
Mock 데이터의 날짜와 테스트 환경의 날짜를 일치시켜야 함:

```typescript
// Mock 데이터에서 설정한 날짜
const mockEvents: Event[] = [
  {
    id: '1',
    title: '기존 회의',
    date: '2025-10-15',  // 이 날짜와 일치해야 함
    // ... 기타 속성
  }
];

// 테스트에서 시스템 시간 설정
vi.setSystemTime(new Date('2025-10-15')); // Mock 데이터와 동일한 날짜
```

### 2단계: 데이터 로딩 대기 로직 추가
비동기 데이터 로딩을 기다리는 로직 구현:

```typescript
// 데이터 로드 대기
await waitFor(() => {
  expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
});
```

**대기 로직의 원리:**
- `queryByText`는 요소가 없으면 `null`을 반환 (에러 발생 안 함)
- `not.toBeInTheDocument()`로 "검색 결과가 없습니다." 텍스트가 사라질 때까지 대기
- 데이터가 로드되면 해당 텍스트가 사라지고 실제 이벤트들이 표시됨

### 3단계: waitFor import 확인
`waitFor`가 올바르게 import되었는지 확인:

```typescript
import { render, screen, within, act, waitFor } from '@testing-library/react';
```

## 완성된 해결책

```typescript
it('반복 일정을 수정하면 해당 일정은 단일 일정으로 변경된다', async () => {
  setupMockHandlerUpdating();
  vi.setSystemTime(new Date('2025-10-15')); // Mock 데이터와 날짜 일치

  const { user } = setup(<App />);

  // 데이터 로드 대기 - 핵심 해결책
  await waitFor(() => {
    expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
  });

  // 이제 "기존 회의" 데이터를 안전하게 찾을 수 있음
  const eventList = within(screen.getByLabelText('일정 목록'));
  const eventItem = eventList.getByText('기존 회의').closest('[role="article"]');
  
  // ... 나머지 테스트 로직
});
```

## 추가 고려사항

### Mock Handler 데이터 검증
`setupMockHandlerUpdating()`에서 제공하는 데이터가 올바른지 확인:

```typescript
export const setupMockHandlerUpdating = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '기존 회의',           // 테스트에서 찾는 텍스트
      date: '2025-10-15',         // 테스트 날짜와 일치
      startTime: '09:00',
      endTime: '10:00',
      description: '기존 팀 미팅',
      location: '회의실 B',
      category: '업무',
      repeat: { type: 'daily', interval: 1 }, // 반복 일정으로 설정
      notificationTime: 10,
    },
    // ... 기타 이벤트
  ];
  // ...
};
```

### 반복 일정 특성 확인
반복 일정임을 나타내는 `repeat` 속성이 올바르게 설정되었는지 확인:
- `repeat.type`이 `'none'`이 아닌 값 (예: `'daily'`)
- UI에서 반복 아이콘이 표시되는지 확인

## 핵심 교훈

### 1. **비동기 데이터 로딩 고려**
Mock API 응답도 비동기적으로 처리되므로 적절한 대기 로직 필요

### 2. **날짜 일관성**
테스트 시스템 시간과 Mock 데이터의 날짜가 일치해야 UI 필터링 로직이 올바르게 작동

### 3. **UI 상태 기반 대기**
특정 UI 상태 ("검색 결과가 없습니다." 텍스트 사라짐)를 기준으로 데이터 로딩 완료 판단

### 4. **Mock Handler 데이터 검증**
테스트 실패 시 Mock 데이터가 예상대로 설정되었는지 먼저 확인

### 5. **queryBy vs getBy 활용**
- `queryBy`: 요소가 없을 수 있는 상황 (대기 로직)
- `getBy`: 요소가 반드시 있어야 하는 상황 (실제 테스트)

이 해결책을 통해 비동기 데이터 로딩과 날짜 필터링이 올바르게 작동하는 환경에서 안정적인 테스트를 수행할 수 있게 되었습니다.
