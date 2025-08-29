# Multiple Elements 에러 해결 - Edit 버튼 접근 문제

## 테스트 목표
반복 일정을 수정할 때 해당 일정이 단일 일정으로 변경되는지 확인

## 발생한 문제

### 문제 1: Found multiple elements with the text of: Edit event
**에러 메시지:**
```
TestingLibraryElementError: Found multiple elements with the text of: Edit event
```

**원인:**
- 일정 목록에 여러 개의 이벤트가 있을 때 각각에 "Edit event" 라벨을 가진 버튼이 존재
- `screen.findByLabelText('Edit event')`가 어떤 버튼을 선택해야 할지 모호함
- 테스트에서 특정 이벤트의 Edit 버튼을 클릭하려고 했지만 전역 검색으로 인해 실패

**DOM 구조:**
```html
<div aria-label="일정 목록">
  <div role="article" aria-label="이벤트: 기존 회의">
    <!-- 이벤트 내용 -->
    <button aria-label="Edit event">...</button>  <!-- 첫 번째 Edit 버튼 -->
  </div>
  <div role="article" aria-label="이벤트: 기존 회의2">
    <!-- 이벤트 내용 -->
    <button aria-label="Edit event">...</button>  <!-- 두 번째 Edit 버튼 -->
  </div>
</div>
```

## 해결 방법

### 1단계: 특정 이벤트 컨테이너부터 접근
전역 검색이 아닌 특정 이벤트 내에서 Edit 버튼을 찾도록 변경:

```typescript
// ❌ 문제가 있는 접근 방법
const editButton = await screen.findByLabelText('Edit event');

// ✅ 해결된 접근 방법
// 1. 먼저 특정 이벤트 아이템 찾기
const eventList = within(screen.getByLabelText('일정 목록'));
const eventItem = eventList.getByText('기존 회의').closest('[role="article"]');

// 2. 해당 이벤트 내에서만 Edit 버튼 찾기
const editButton = within(eventItem as HTMLElement).getByLabelText('Edit event');
```

### 2단계: 스코프를 제한한 쿼리 사용
`within()` 헬퍼를 사용하여 검색 범위를 특정 DOM 영역으로 제한:

```typescript
const eventList = within(screen.getByLabelText('일정 목록'));
const eventItem = eventList.getByText('기존 회의').closest('[role="article"]');
const editButton = within(eventItem as HTMLElement).getByLabelText('Edit event');
await user.click(editButton);
```

## 핵심 교훈

### 1. **범위 제한의 중요성**
전역 검색보다는 특정 컨테이너 내에서 검색하여 모호성 제거

### 2. **계층적 접근**
1. 상위 컨테이너 (일정 목록) 접근
2. 특정 아이템 (특정 이벤트) 접근  
3. 아이템 내 요소 (Edit 버튼) 접근

### 3. **DOM 구조 이해**
- `role="article"`을 사용한 개별 이벤트 식별
- `aria-label="일정 목록"`을 사용한 컨테이너 식별
- 계층적 DOM 구조 활용

### 4. **within() 헬퍼 활용**
```typescript
// 범위를 제한하여 모호성 해결
const scopedElement = within(containerElement).getByLabelText('target');
```

### 5. **접근성 우선 쿼리 장점**
- `data-testid` 대신 `aria-label`, `role` 등 접근성 속성 활용
- 실제 사용자 경험과 일치하는 테스트 작성
- 의미 있는 DOM 구조 유도

## 최종 해결된 코드

```typescript
it('반복 일정을 수정하면 해당 일정은 단일 일정으로 변경된다', async () => {
  setupMockHandlerUpdating();
  vi.setSystemTime(new Date('2025-10-15'));

  const { user } = setup(<App />);

  // 데이터 로드 대기
  await waitFor(() => {
    expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
  });

  // 기존 회의 이벤트 아이템 찾기 (범위 제한)
  const eventList = within(screen.getByLabelText('일정 목록'));
  const eventItem = eventList.getByText('기존 회의').closest('[role="article"]');
  
  // 해당 이벤트의 수정 버튼 클릭 (스코프 제한)
  const editButton = within(eventItem as HTMLElement).getByLabelText('Edit event');
  await user.click(editButton);

  // 제목 수정
  await user.clear(screen.getByLabelText('제목'));
  await user.type(screen.getByLabelText('제목'), '수정된 단일 일정');

  await user.click(screen.getByRole('button', { name: /일정 수정/ }));

  const updatedEventItem = eventList
    .getByText('수정된 단일 일정')
    .closest('[role="article"]');

  // 반복 아이콘이 사라졌는지 확인
  expect(within(updatedEventItem as HTMLElement).queryByLabelText('반복 일정')).not.toBeInTheDocument();
});
```

이 해결책을 통해 여러 개의 동일한 라벨을 가진 요소들 사이에서 정확한 요소를 선택할 수 있게 되었습니다.
