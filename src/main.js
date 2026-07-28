import './style.css';
import { createPost, fetchPosts, getAnonymousUser, isSupabaseConfigured, toggleLike } from './supabase.js';

const EMOJIS = ['🍀', '🍒', '🦋', '🌼', '🐈', '☁️', '🍓', '🫧'];
const ALIASES = ['민트젤리', '보라구름', '레몬버터', '복숭아콩', '라일락밤', '크림소다'];

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

function makeAlias() {
  return `익명의 ${ALIASES[Math.floor(Math.random() * ALIASES.length)]}`;
}

function postTemplate(post) {
  return `<article class="note" style="--x:${post.x}; --y:${post.y}; --r:${post.rotate}deg" data-id="${post.id}">
    <div class="window-bar"><span></span><span></span><span></span><b>posty.note</b></div>
    <div class="note-body">
      <div class="note-emoji">${post.emoji}</div>
      <p>${escapeHtml(post.text)}</p>
      <footer><small>${post.alias}</small><button class="like-button" aria-label="좋아요"><i>♥</i> <em>${post.likes}</em></button></footer>
    </div>
  </article>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function render() {
  document.querySelector('#app').innerHTML = `
    <main class="board">
      <header class="topbar"><a class="brand" href="/">posty<span>.</span></a><p>${isSupabaseConfigured ? '익명의 한마디를 남겨요' : '데모 모드 · Supabase 연결 대기 중'}</p><span class="post-count">${posts.length} NOTES</span></header>
      <section class="notes" aria-label="방명록 목록">${posts.map(postTemplate).join('')}</section>
      <p class="hint">마음에 드는 한마디에 ♥를 눌러보세요</p>
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
  bindEvents();
}

function bindEvents() {
  const composer = document.querySelector('#composer');
  document.querySelector('#open-composer').onclick = () => composer.classList.add('show');
  document.querySelector('#close-composer').onclick = () => composer.classList.remove('show');
  composer.onclick = (event) => { if (event.target === composer) composer.classList.remove('show'); };
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
  document.querySelector('#composer-form').onsubmit = async (event) => {
    event.preventDefault();
    const text = message.value.trim();
    if (!text) return;
    const newPost = { id: Date.now(), alias: assignedAlias, emoji: selectedEmoji, text, likes: 0, x: 38 + Math.random() * 20, y: 25 + Math.random() * 18, rotate: Math.random() * 4 - 2 };
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
  if (!isSupabaseConfigured) return;
  try {
    currentUser = await getAnonymousUser();
    posts = await fetchPosts();
    render();
  } catch (error) {
    showToast(`Supabase 연결 오류: ${error.message}`, true);
  }
}

bootstrap();
