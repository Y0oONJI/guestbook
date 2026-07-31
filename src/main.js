import './style.css';
import { createPost, fetchPosts, getAnonymousUser, isSupabaseConfigured, toggleLike, updatePostPosition } from './supabase.js';

const EMOJIS = ['🍀', '🍒', '🦋', '🌼', '🐈', '☁️', '🍓', '🫧'];
const ALIASES = [
  '민트젤리', '보라구름', '레몬버터', '복숭아콩', '라일락밤', '크림소다',
  '딸기우유', '자몽에이드', '코코넛눈', '바닐라구슬', '오렌지노을', '자두우유',
  '블루베리비', '망고빙수', '은하수사탕', '솜사탕구름', '청포도알', '밤하늘별',
  '유자차향', '붕어빵맘', '호박엿가락', '산딸기잼'
];

const initialPosts = [
  { id: 1, alias: '익명의 민트젤리', emoji: '🍀', text: '오늘은 왠지 좋은 일이 생길 것 같은 날!', likes: 12, x: 7, y: 12, rotate: -2 },
  { id: 2, alias: '익명의 보라구름', emoji: '🦋', text: '잠깐 들렀다가 따뜻한 말 하나 남기고 가요.', likes: 8, x: 37, y: 7, rotate: 2 },
  { id: 3, alias: '익명의 레몬버터', emoji: '🌼', text: '햇빛이 좋아서 기분이 아주 조금 들떴어.', likes: 21, x: 68, y: 18, rotate: -1 },
  { id: 4, alias: '익명의 복숭아콩', emoji: '🍒', text: '오늘도 수고했어. 내일은 더 가볍게!', likes: 4, x: 21, y: 53, rotate: 1 },
  { id: 5, alias: '익명의 크림소다', emoji: '☁️', text: '여기는 조용하고 귀여운 방명록.', likes: 16, x: 54, y: 51, rotate: -2 }
];

// Supabase를 연결하면 실제 DB 결과만 보여 준다. 샘플 글은 로컬 데모에서만 사용한다.
let posts = isSupabaseConfigured ? [] : [...initialPosts];
let selectedEmoji = EMOJIS[0];
let assignedAlias = makeAlias();
let currentUser = null;
let view = 'today';
let archiveDate = null;
let isLoading = isSupabaseConfigured;

function makeAlias() {
  return `익명의 ${ALIASES[Math.floor(Math.random() * ALIASES.length)]}`;
}

function kstDateKey(isoString) {
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function kstDateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
}

function getTodayPosts() {
  if (!isSupabaseConfigured) return posts;
  const todayKey = kstDateKey(new Date().toISOString());
  return posts.filter((post) => post.createdAt && kstDateKey(post.createdAt) === todayKey);
}

function getArchiveDates() {
  const todayKey = kstDateKey(new Date().toISOString());
  const keys = new Set();
  posts.forEach((post) => { if (post.createdAt) keys.add(kstDateKey(post.createdAt)); });
  keys.delete(todayKey);
  return [...keys].sort((a, b) => b.localeCompare(a)).map((key) => ({ key, label: kstDateLabel(key) }));
}

function getPostsForDate(dateKey) {
  return posts.filter((post) => post.createdAt && kstDateKey(post.createdAt) === dateKey);
}

const LAYOUT_MARGIN = { x: 4, yMin: 5, yMax: 60 };
const LAYOUT_ATTEMPTS = 40;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// 겹치지 않는 새 자리를 찾는다. 글을 만들거나 옮길 때 한 번만 계산해서 DB에 저장한다.
function findOpenSpot(existingPosts) {
  const containerWidth = Math.min(window.innerWidth, 1440);
  const containerHeight = Math.max(window.innerHeight - 78, 400);
  const noteWidth = clamp(containerWidth * 0.15, 140, 195);
  const noteWidthPercent = (noteWidth / containerWidth) * 100;
  const bounds = { xMin: LAYOUT_MARGIN.x, xMax: Math.min(100 - LAYOUT_MARGIN.x - noteWidthPercent, 95), yMin: LAYOUT_MARGIN.yMin, yMax: LAYOUT_MARGIN.yMax };
  const minDistance = noteWidth * 0.95;
  const placed = existingPosts.map((post) => ({
    xPx: (post.x / 100) * containerWidth,
    yPx: (post.y / 100) * containerHeight
  }));
  let best = null;
  let bestDistance = -Infinity;
  for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt++) {
    const x = bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
    const y = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
    const xPx = (x / 100) * containerWidth;
    const yPx = (y / 100) * containerHeight;
    const distance = placed.reduce((min, point) => Math.min(min, Math.hypot(point.xPx - xPx, point.yPx - yPx)), Infinity);
    if (distance > bestDistance) { bestDistance = distance; best = { x, y }; }
    if (bestDistance >= minDistance) break;
  }
  return { x: best.x, y: best.y, rotate: Math.random() * 4 - 2 };
}

function postTemplate(post) {
  return `<article class="note" style="--x:${post.x}; --y:${post.y}; --r:${post.rotate}deg" data-id="${post.id}">
    <div class="window-bar"><span></span><span></span><span></span><b>posty.note</b></div>
    <div class="note-body">
      <div class="note-emoji">${post.emoji}</div>
      <p>${escapeHtml(post.text)}</p>
      <footer><small>${escapeHtml(post.alias)}</small><button class="like-button" aria-label="좋아요"><i>♥</i> <em>${post.likes}</em></button></footer>
    </div>
  </article>`;
}

const UPDATE_NOTES = {
  version: 2,
  title: '업데이트 소식',
  items: [
    '포스트잇을 마음대로 옮겨보세요 — 제목 표시줄을 잡고 드래그하면 원하는 자리에 놓을 수 있어요.',
    '지난 글도 다시 볼 수 있어요 — 왼쪽 아래 "이전글 보기" 버튼에서 지난 날짜의 기록을 확인해보세요.'
  ]
};

function showUpdateNotesIfNeeded() {
  const seenVersion = Number(localStorage.getItem('updateNotesSeenVersion') || 0);
  if (seenVersion >= UPDATE_NOTES.version) return;
  const modal = document.createElement('div');
  modal.className = 'update-modal-backdrop show';
  modal.innerHTML = `
    <div class="update-modal">
      <button type="button" class="close-button" id="close-update-notes" aria-label="닫기">×</button>
      <p class="eyebrow">WHAT'S NEW</p>
      <h2>${UPDATE_NOTES.title}</h2>
      <ul>${UPDATE_NOTES.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>`;
  document.body.appendChild(modal);
  const close = () => {
    localStorage.setItem('updateNotesSeenVersion', String(UPDATE_NOTES.version));
    modal.remove();
  };
  modal.querySelector('#close-update-notes').onclick = close;
  modal.onclick = (event) => { if (event.target === modal) close(); };
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function render() {
  if (view === 'archive-day') return renderArchiveDay();
  renderToday();
}

function archiveNavMarkup() {
  if (!isSupabaseConfigured) return '';
  const dates = getArchiveDates();
  const items = [];
  if (view === 'archive-day') items.push('<li><button class="date-item today-item" data-date="today">↩ 오늘로 돌아가기</button></li>');
  items.push(...dates.map((d) => `<li><button class="date-item" data-date="${d.key}">${d.label}</button></li>`));
  return `
    <div class="archive-nav">
      <div class="archive-dropdown" id="archive-dropdown">
        ${items.length ? `<ul class="date-list">${items.join('')}</ul>` : '<p class="empty-archive">아직 지난 글이 없어요</p>'}
      </div>
      <button class="archive-button" id="open-archive" aria-expanded="false">이전글 보기</button>
    </div>`;
}

function bindArchiveNav() {
  const button = document.querySelector('#open-archive');
  const dropdown = document.querySelector('#archive-dropdown');
  if (button && dropdown) {
    button.onclick = (event) => {
      event.stopPropagation();
      const isOpen = dropdown.classList.toggle('show');
      button.setAttribute('aria-expanded', String(isOpen));
    };
    document.querySelectorAll('.date-item').forEach((item) => item.onclick = () => {
      if (item.dataset.date === 'today') {
        view = 'today';
        archiveDate = null;
      } else {
        archiveDate = item.dataset.date;
        view = 'archive-day';
      }
      render();
    });
  }
  const brand = document.querySelector('.brand');
  if (brand) brand.onclick = (event) => {
    event.preventDefault();
    view = 'today';
    archiveDate = null;
    render();
  };
}

function renderToday() {
  const todayPosts = getTodayPosts();
  document.querySelector('#app').innerHTML = `
    <main class="board">
      <header class="topbar"><a class="brand" href="/">posty<span>.</span></a><p>${isSupabaseConfigured ? '익명의 한마디를 남겨요' : '데모 모드 · Supabase 연결 대기 중'}</p><span class="post-count">${isLoading ? '···' : `${todayPosts.length} NOTES`}</span></header>
      <section class="notes" aria-label="방명록 목록">${isLoading ? '<p class="empty-board">불러오는 중...</p>' : todayPosts.length ? todayPosts.map(postTemplate).join('') : '<p class="empty-board">오늘은 아직 아무도 글을 안 남겼어요.<br />첫 포스트잇을 붙여보세요!</p>'}</section>
      ${archiveNavMarkup()}
      <button class="add-button" id="open-composer" aria-label="방명록 남기기"><span>+</span><b>한마디 남기기</b></button>
      <section class="composer-backdrop" id="composer" aria-hidden="true">
        <form class="composer" id="composer-form">
          <div class="window-bar"><span></span><span></span><span></span><b>new.note</b><button type="button" class="close-button" id="close-composer" aria-label="닫기">×</button></div>
          <div class="composer-content">
            <p class="eyebrow">ANONYMOUS GUESTBOOK</p><h1>작은 한마디를<br />남겨주세요.</h1>
            <label class="field-label">오늘의 이모지</label>
            <div class="emoji-picker">${EMOJIS.map(emoji => `<button type="button" class="emoji-choice ${emoji === selectedEmoji ? 'selected' : ''}" data-emoji="${emoji}">${emoji}</button>`).join('')}</div>
            <label class="field-label" for="message">메시지 <span id="count">0 / 150</span></label>
            <textarea id="message" name="message" maxlength="150" required placeholder="오늘의 마음을 짧게 적어주세요."></textarea>
            <div class="identity"><span>FROM</span><strong>${assignedAlias}</strong><button type="button" id="refresh-alias" aria-label="닉네임 새로 고르기">↻</button></div>
            <button class="submit-button" type="submit">포스트잇 붙이기 <span>↗</span></button>
          </div>
        </form>
      </section>
      <div class="toast" id="toast" role="status"></div>
    </main>`;
  bindTodayEvents();
}

function renderArchiveDay() {
  const dayPosts = getPostsForDate(archiveDate);
  const label = kstDateLabel(archiveDate);
  document.querySelector('#app').innerHTML = `
    <main class="board">
      <header class="topbar"><a class="brand" href="/">posty<span>.</span></a><p>${label} 기록</p><span class="post-count">${dayPosts.length} NOTES</span></header>
      <section class="notes readonly" aria-label="지난 방명록 목록">${dayPosts.map(postTemplate).join('')}</section>
      ${archiveNavMarkup()}
    </main>`;
  bindArchiveNav();
}

function bindTodayEvents() {
  const composer = document.querySelector('#composer');
  document.querySelector('#open-composer').onclick = () => composer.classList.add('show');
  document.querySelector('#close-composer').onclick = () => composer.classList.remove('show');
  composer.onclick = (event) => { if (event.target === composer) composer.classList.remove('show'); };
  bindArchiveNav();
  document.querySelectorAll('.emoji-choice').forEach(button => button.onclick = () => {
    selectedEmoji = button.dataset.emoji;
    document.querySelectorAll('.emoji-choice').forEach(choice => choice.classList.toggle('selected', choice === button));
  });
  document.querySelector('#refresh-alias').onclick = () => {
    assignedAlias = makeAlias();
    document.querySelector('.identity strong').textContent = assignedAlias;
  };
  const message = document.querySelector('#message');
  message.oninput = () => document.querySelector('#count').textContent = `${message.value.length} / 150`;
  document.querySelectorAll('.like-button').forEach(button => button.onclick = async (event) => {
    const note = event.currentTarget.closest('.note');
    const post = posts.find(item => String(item.id) === note.dataset.id);
    try {
      post.likes = isSupabaseConfigured ? await toggleLike(post.id) : post.likes + 1;
    } catch (error) {
      showToast(`좋아요를 저장하지 못했어요: ${error.message}`, true);
      return;
    }
    button.querySelector('em').textContent = post.likes;
    button.classList.remove('popped'); void button.offsetWidth; button.classList.add('popped');
  });
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  if (!isMobile) {
    document.querySelectorAll('.note .window-bar').forEach(bar => bar.onpointerdown = (event) => startDrag(event, bar.closest('.note')));
  }
  document.querySelector('#composer-form').onsubmit = async (event) => {
    event.preventDefault();
    const text = message.value.trim();
    if (!text) return;
    const spot = findOpenSpot(getTodayPosts());
    const newPost = { id: Date.now(), alias: assignedAlias, emoji: selectedEmoji, text, likes: 0, x: spot.x, y: spot.y, rotate: spot.rotate };
    try {
      posts.unshift(isSupabaseConfigured ? await createPost(newPost, currentUser.id) : newPost);
    } catch (error) {
      showToast(`글을 저장하지 못했어요: ${error.message}`, true);
      return;
    }
    assignedAlias = makeAlias();
    render();
    showToast('포스트잇을 붙였어요! ✦');
  };
}

function startDrag(event, note) {
  event.preventDefault();
  const container = document.querySelector('.notes');
  const containerRect = container.getBoundingClientRect();
  const noteRect = note.getBoundingClientRect();
  const offsetX = event.clientX - noteRect.left;
  const offsetY = event.clientY - noteRect.top;
  const noteWidthPercent = (noteRect.width / containerRect.width) * 100;
  const noteHeightPercent = (noteRect.height / containerRect.height) * 100;
  const xMax = Math.min(100 - noteWidthPercent - 0.5, 95);
  const yMax = Math.min(100 - noteHeightPercent - 0.5, 80);
  note.classList.add('dragging');
  let x = Number(note.style.getPropertyValue('--x'));
  let y = Number(note.style.getPropertyValue('--y'));

  function onMove(moveEvent) {
    const xPx = moveEvent.clientX - containerRect.left - offsetX;
    const yPx = moveEvent.clientY - containerRect.top - offsetY;
    x = clamp((xPx / containerRect.width) * 100, 0, xMax);
    y = clamp((yPx / containerRect.height) * 100, 4, yMax);
    note.style.setProperty('--x', x);
    note.style.setProperty('--y', y);
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    note.classList.remove('dragging');
    const post = posts.find(item => String(item.id) === note.dataset.id);
    if (!post || (post.x === x && post.y === y)) return;
    post.x = x;
    post.y = y;
    if (isSupabaseConfigured) {
      updatePostPosition(post.id, post.x, post.y, post.rotate).catch(() => {
        showToast('위치를 저장하지 못했어요. 새로고침하면 원래대로 돌아가요.', true);
      });
    }
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function showToast(message, isError = false) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

async function bootstrap() {
  render();
  showUpdateNotesIfNeeded();
  if (!isSupabaseConfigured) return;
  try {
    currentUser = await getAnonymousUser();
    posts = await fetchPosts();
  } catch (error) {
    showToast(`Supabase 연결 오류: ${error.message}`, true);
  } finally {
    isLoading = false;
    render();
  }
}

document.addEventListener('click', (event) => {
  const dropdown = document.querySelector('#archive-dropdown');
  const button = document.querySelector('#open-archive');
  if (!dropdown || !dropdown.classList.contains('show')) return;
  if (event.target === button || dropdown.contains(event.target)) return;
  dropdown.classList.remove('show');
  if (button) button.setAttribute('aria-expanded', 'false');
});

bootstrap();
