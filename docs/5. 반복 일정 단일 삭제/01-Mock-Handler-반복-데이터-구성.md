# Mock Handler 반복 데이터 구성 문제 해결

## 테스트 목표
반복 일정의 개별 인스턴스를 삭제했을 때, 해당 인스턴스만 삭제되고 다른 인스턴스는 유지되는지 확인

## 발생한 문제

### 문제 1: Mock 데이터가 반복 일정이 아님
**에러 메시지:**
```
TestingLibraryElementError: Unable to find an element with the text: 반복 일정
```

**원인:**
```typescript
// 기존 setupMockHandlerDeletion() - 문제가 있던 구조
export const setupMockHandlerDeletion = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '삭제할 이벤트',           // ❌ 테스트에서 찾는 '반복 일정'과 다름
      date: '2025-10-15',
      repeat: { type: 'none', interval: 0 }, // ❌ 반복 일정이 아님
      // ... 기타 속성
    },
  ];
  // ...
};
```

**문제점 분석:**
1. **제목 불일치**: 테스트에서 `'반복 일정'` 텍스트를 찾는데 Mock 데이터는 `'삭제할 이벤트'`
2. **반복 설정 누락**: `repeat.type`이 `'none'`으로 설정되어 반복 일정이 아님
3. **단일 인스턴스**: 반복 일정의 여러 인스턴스가 생성되지 않음

## 해결 방법

### 1단계: 반복 일정 기본 이벤트 정의
반복 일정 삭제를 테스트하기 위해서는 먼저 올바른 반복 일정이 있어야 함:

```typescript
const baseEvent: Event = {
  id: '1',
  title: '반복 일정',                    // ✅ 테스트와 일치하는 제목
  date: '2025-10-15',
  startTime: '09:00',
  endTime: '10:00',
  description: '매일 반복되는 일정',
  location: '회의실 A',
  category: '업무',
  repeat: { type: 'daily', interval: 1 }, // ✅ 매일 반복 설정
  notificationTime: 10,
};
```

### 2단계: 반복 일정 인스턴스 생성
기존 `generateRepeatingEvents` 함수를 활용하여 여러 날짜의 인스턴스 생성:

```typescript
// 반복 일정의 여러 인스턴스 생성
const mockEvents: Event[] = generateRepeatingEvents(baseEvent);
```

**생성되는 데이터 구조:**
```typescript
[
  { id: '1-1', title: '반복 일정', date: '2025-10-15', ... },
  { id: '1-2', title: '반복 일정', date: '2025-10-16', ... },
  { id: '1-3', title: '반복 일정', date: '2025-10-17', ... },
  // ... 더 많은 인스턴스들
]
```

### 3단계: 개별 삭제 로직 구현
특정 인스턴스만 삭제할 수 있도록 DELETE 핸들러 개선:

```typescript
http.delete('/api/events/:id', ({ params }) => {
  const { id } = params;
  const index = mockEvents.findIndex((event) => event.id === id);

  if (index !== -1) {
    mockEvents.splice(index, 1);  // 해당 인스턴스만 제거
  }
  return new HttpResponse(null, { status: 204 });
})
```

## 완성된 해결책

```typescript
export const setupMockHandlerDeletion = () => {
  // 반복 일정 기본 이벤트
  const baseEvent: Event = {
    id: '1',
    title: '반복 일정',
    date: '2025-10-15',
    startTime: '09:00',
    endTime: '10:00',
    description: '매일 반복되는 일정',
    location: '회의실 A',
    category: '업무',
    repeat: { type: 'daily', interval: 1 },
    notificationTime: 10,
  };

  // 반복 일정의 여러 인스턴스 생성
  const mockEvents: Event[] = generateRepeatingEvents(baseEvent);

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
```

## 핵심 교훈

### 1. **테스트 데이터 일관성**
테스트에서 검증하려는 데이터와 Mock에서 제공하는 데이터가 정확히 일치해야 함

### 2. **비즈니스 로직 반영**
- 반복 일정 삭제는 "반복 일정" 데이터가 전제 조건
- Mock 데이터도 실제 기능과 동일한 특성을 가져야 함

### 3. **기존 함수 재활용**
- `generateRepeatingEvents` 함수를 재사용하여 일관된 반복 일정 생성
- 코드 중복 방지 및 동일한 로직 보장

### 4. **Mock Handler 설계 원칙**
```typescript
// ✅ 올바른 설계
1. 테스트 목적에 맞는 데이터 구조
2. 실제 API 동작과 일치하는 로직
3. 테스트 시나리오를 지원하는 충분한 데이터

// ❌ 피해야 할 설계
1. 테스트와 무관한 임의의 데이터
2. 실제 기능과 다른 동작
3. 부족하거나 잘못된 데이터 구조
```

### 5. **반복 일정 특성 이해**
- 반복 일정은 여러 인스턴스로 구성
- 각 인스턴스는 독립적으로 삭제 가능
- `generateRepeatingEvents`로 실제와 동일한 구조 생성

이 해결책을 통해 반복 일정의 개별 삭제 기능을 정확히 테스트할 수 있는 환경을 구축했습니다.
