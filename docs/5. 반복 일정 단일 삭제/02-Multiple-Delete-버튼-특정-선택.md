# Multiple Delete 버튼 중 특정 버튼 선택 문제 해결

## 테스트 목표
여러 개의 반복 일정 인스턴스 중 특정 하나의 Delete 버튼을 정확히 선택하여 클릭

## 발생한 문제

### 문제 1: Found multiple elements with the text of: Delete event
**예상 에러 (해결된 상태):**
```
TestingLibraryElementError: Found multiple elements with the text of: Delete event
```

**원인:**
반복 일정이 여러 인스턴스로 생성되면서 각각에 "Delete event" 라벨을 가진 버튼이 존재:

```html
<div aria-label="일정 목록">
  <div role="article" aria-label="이벤트: 반복 일정">
    <p>반복 일정</p>
    <p>2025-10-15</p>
    <button aria-label="Delete event">🗑️</button>  <!-- 첫 번째 Delete 버튼 -->
  </div>
  <div role="article" aria-label="이벤트: 반복 일정">
    <p>반복 일정</p>
    <p>2025-10-16</p>
    <button aria-label="Delete event">🗑️</button>  <!-- 두 번째 Delete 버튼 -->
  </div>
  <!-- ... 더 많은 인스턴스들 -->
</div>
```

## 해결 방법

### 1단계: 특정 이벤트 인스턴스부터 접근
전역 검색이 아닌 특정 이벤트 인스턴스 내에서 Delete 버튼을 찾도록 변경:

```typescript
// ❌ 문제가 있는 접근 방법
const deleteButton = await screen.findByLabelText('Delete event');

// ✅ 해결된 접근 방법
// 1. 모든 반복 일정 인스턴스 찾기
const eventList = within(screen.getByLabelText('일정 목록'));
const allEventTexts = eventList.getAllByText('반복 일정');

// 2. 첫 번째 인스턴스의 컨테이너 찾기
const firstEventItem = allEventTexts[0].closest('[role="article"]');

// 3. 해당 인스턴스 내에서만 Delete 버튼 찾기
const deleteButton = within(firstEventItem as HTMLElement).getByLabelText('Delete event');
```

### 2단계: 스코프 제한된 쿼리 사용
`within()` 헬퍼를 사용하여 검색 범위를 특정 DOM 영역으로 제한:

```typescript
// 첫 번째 반복 일정의 삭제 버튼 찾기
const firstEventItem = eventList.getAllByText('반복 일정')[0].closest('[role="article"]');
const deleteButton = within(firstEventItem as HTMLElement).getByLabelText('Delete event');
```

### 3단계: 삭제 전후 상태 검증
개별 삭제가 정확히 동작하는지 확인하기 위한 검증 로직:

```typescript
// 삭제 전 이벤트 개수 확인
const beforeDeleteCount = eventList.getAllByText('반복 일정').length;

await user.click(deleteButton);

// 해당 인스턴스만 삭제되어 개수가 줄어들어야 함
await waitFor(() => {
  const afterDeleteCount = eventList.queryAllByText('반복 일정').length;
  expect(afterDeleteCount).toBe(beforeDeleteCount - 1);
});
```

## 완성된 테스트 코드

```typescript
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

  // 첫 번째 반복 일정의 삭제 버튼 찾기 (스코프 제한)
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
```

## 핵심 교훈

### 1. **계층적 접근의 중요성**
```typescript
// 단계별 접근
1. 컨테이너 접근: getByLabelText('일정 목록')
2. 특정 인스턴스 선택: getAllByText('반복 일정')[0]
3. 인스턴스 내 버튼 접근: within().getByLabelText('Delete event')
```

### 2. **Array 인덱스 활용**
- `getAllByText()`로 여러 요소를 가져온 후 `[0]`으로 첫 번째 선택
- 예측 가능하고 일관된 테스트 동작 보장

### 3. **closest() 메서드 활용**
```typescript
const eventContainer = eventText.closest('[role="article"]');
```
- 텍스트 요소에서 상위 컨테이너로 이동
- `role="article"`로 개별 이벤트 아이템 식별

### 4. **삭제 검증 전략**
```typescript
// ✅ 올바른 검증 방법
1. 삭제 전 개수 확인
2. 삭제 작업 수행
3. 삭제 후 개수 비교 (beforeCount - 1)

// ❌ 부적절한 검증 방법
1. 특정 ID나 텍스트의 존재/부재만 확인
2. 전체 삭제 여부만 확인
```

### 5. **queryAllBy vs getAllBy 선택**
```typescript
// 삭제 전: getAllBy (반드시 존재해야 함)
const beforeCount = eventList.getAllByText('반복 일정').length;

// 삭제 후: queryAllBy (없을 수도 있음)
const afterCount = eventList.queryAllByText('반복 일정').length;
```

### 6. **waitFor 활용**
- 삭제는 비동기 작업이므로 `waitFor`로 상태 변화 대기
- DOM 업데이트가 완료된 후 검증 수행

## 비교: Edit vs Delete 버튼 선택

### 공통점
- Multiple elements 문제 동일
- `within()` 헬퍼로 스코프 제한
- 계층적 접근 방식 사용

### 차이점
```typescript
// Edit: 수정 후 상태 확인
expect(updatedItem.queryByLabelText('반복 일정')).not.toBeInTheDocument();

// Delete: 개수 변화 확인  
expect(afterDeleteCount).toBe(beforeDeleteCount - 1);
```

이 해결책을 통해 여러 개의 동일한 Delete 버튼 중에서 정확한 버튼을 선택하고, 개별 삭제가 올바르게 동작하는지 검증할 수 있게 되었습니다.
