import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import {
  XCircle,
  Shield,
  Swords,
  ScrollText,
  Users,
  BarChart3,
  Lock,
  LogOut,
  Menu,
  ChevronRight,
  X,
  UserPlus,
  CheckCircle2,
  Ban,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  Save,
  Settings,
  Snowflake,
} from "lucide-react";
import { cx, splitList, counterRingSlots, parseCounterDecks, parseAttackGuideItems, stringifyAttackGuideItems, stringifyCounterDecks, normalizeMultilineText, renderRichText, mapProfile, statusLabel, formatUpdatedAt, formatLastSeen, isVisibleItem, isGuest, GuestLockedContent, roleLabel, isSuperAdminId, isHiddenUserId, upsertSetting, PageShell, PageHeader, Button, DeleteButton, Input, TextArea, Select, splitFormation, normalizedFormation, FormationField, InfoChip, Modal, StatusBadge, RoleBadge, EmptyState, PlaceholderPage, emptyDefense, emptyTotalWar, emptyArena, emptyAttackTeam, emptyEnemyDefense, emptyCounterDeck, emptyNotice } from "./siteUi.jsx";
import CounterTransferButton from "./CounterTransferButton.jsx";
import { CounterOrderFields, CounterOrderDisplay } from "./CounterOrderFields.jsx";
import { parseCounterOrder, describeCounterOrder } from "../lib/counterOrders.js";
import { matchesHeroSearch, matchesEnemyTeamSearch, searchTokens } from "../lib/heroSearch.js";
import { sortByRecommendation } from "../lib/recommendationSort.js";

const GUILD_BOARD_IMAGE_BUCKET = "guild-board-images";
const GUILD_BOARD_MAX_IMAGES = 3;
const GUILD_BOARD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const GUILD_BOARD_ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const GUILD_BOARD_PAGE_SIZE = 20;

function parseBoardImagePaths(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function boardImageExtension(file) {
  const rawExt = String(file?.name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  if (rawExt && rawExt.length <= 8) return rawExt;
  return {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  }[file?.type] || "jpg";
}

function buildBoardImagePath(userId, scope, file) {
  const safeUserId = String(userId || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${safeUserId}/${scope}/${Date.now()}-${randomId}.${boardImageExtension(file)}`;
}

async function boardSignedImageUrls(paths) {
  const cleanPaths = [...new Set((paths || []).filter(Boolean))];
  if (!cleanPaths.length) return new Map();
  const { data, error } = await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).createSignedUrls(cleanPaths, 60 * 60);
  if (error) {
    console.warn("board image signed url load failed:", error.message);
    return new Map();
  }
  return new Map((data || []).filter((item) => item?.path && item?.signedUrl).map((item) => [item.path, item.signedUrl]));
}

function BoardImagePicker({ files, setFiles, label = "사진 첨부" }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  const chooseFiles = (event) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = "";
    if (!incoming.length) return;
    if (files.length + incoming.length > GUILD_BOARD_MAX_IMAGES) return alert(`사진은 최대 ${GUILD_BOARD_MAX_IMAGES}장까지 첨부할 수 있어.`);
    for (const file of incoming) {
      if (!GUILD_BOARD_ALLOWED_IMAGE_TYPES.has(file.type)) return alert("JPG, PNG, WEBP, GIF, HEIC 사진만 첨부할 수 있어.");
      if (file.size > GUILD_BOARD_MAX_IMAGE_BYTES) return alert("사진 한 장은 최대 10MB까지 업로드할 수 있습니다.");
    }
    setFiles((prev) => [...prev, ...incoming]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50">
          <Plus size={15} /> {label}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple className="hidden" onChange={chooseFiles} />
        </label>
        <span className="text-xs text-zinc-400">최대 3장 · 장당 10MB</span>
      </div>
      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((item, index) => (
            <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <img src={item.url} alt="첨부 미리보기" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><XCircle size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardStoredImages({ paths }) {
  const cleanPaths = parseBoardImagePaths(paths);
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map = await boardSignedImageUrls(cleanPaths);
      if (!cancelled) setUrls(cleanPaths.map((path) => ({ path, url: map.get(path) || "" })).filter((item) => item.url));
    };
    load();
    return () => { cancelled = true; };
  }, [JSON.stringify(cleanPaths)]);
  if (!urls.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {urls.map((item) => (
        <a key={item.path} href={item.url} target="_blank" rel="noreferrer" className="block h-28 w-28 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 sm:h-36 sm:w-36">
          <img src={item.url} alt="첨부 이미지" className="h-full w-full object-cover transition hover:scale-[1.03]" />
        </a>
      ))}
    </div>
  );
}

async function uploadBoardImages(userId, scope, files) {
  const uploaded = [];
  for (const file of files) {
    const path = buildBoardImagePath(userId, scope, file);
    const { error } = await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
    if (error) {
      if (uploaded.length) await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).remove(uploaded);
      throw error;
    }
    uploaded.push(path);
  }
  return uploaded;
}

async function removeBoardImages(paths) {
  const clean = parseBoardImagePaths(paths);
  if (!clean.length) return;
  const { error } = await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).remove(clean);
  if (error) console.warn("board image delete failed:", error.message);
}


function GuildBoardPage({ currentUser, users }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Guild Board" title="자유게시판" desc="길드원끼리 자유롭게 글과 댓글을 남기는 게시판입니다." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(GUILD_BOARD_PAGE_SIZE);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentFiles, setCommentFiles] = useState([]);
  const [commenting, setCommenting] = useState(false);

  const resolveNickname = (authorId, fallback) => users.find((user) => user.id === authorId)?.gameNickname || fallback || "알 수 없음";
  const canDelete = (authorId) => currentUser.role === "admin" || currentUser.id === authorId;

  const loadPosts = async () => {
    setLoading(true);
    const { data, error, count } = await supabase
      .from("guild_board_posts")
      .select("*, guild_board_comments(count)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, visibleCount - 1);
    setLoading(false);
    if (error) return alert(`게시글 불러오기 실패: ${error.message}`);
    setPosts(data || []);
    setHasMore((count || 0) > (data || []).length);
    if (selectedPost) {
      const refreshed = (data || []).find((item) => item.id === selectedPost.id);
      if (refreshed) setSelectedPost(refreshed);
    }
  };

  const loadComments = async (postId) => {
    if (!postId) return setComments([]);
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from("guild_board_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setCommentsLoading(false);
    if (error) return alert(`댓글 불러오기 실패: ${error.message}`);
    setComments(data || []);
  };

  useEffect(() => { loadPosts(); }, [visibleCount]);
  useEffect(() => { if (selectedPost?.id) loadComments(selectedPost.id); }, [selectedPost?.id]);

  const createPost = async () => {
    const cleanTitle = postTitle.trim();
    const cleanBody = postBody.trim();
    if (posting) return;
    if (!cleanTitle) return alert("제목을 입력해 주세요.");
    if (!cleanBody && postFiles.length === 0) return alert("내용이나 사진을 하나 이상 입력해 주세요.");
    setPosting(true);
    let imagePaths = [];
    try {
      imagePaths = await uploadBoardImages(currentUser.authUserId, "posts", postFiles);
      const { error } = await supabase.from("guild_board_posts").insert({
        title: cleanTitle,
        body: cleanBody,
        author_id: currentUser.id,
        author_nickname: currentUser.gameNickname,
        image_paths: imagePaths,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setPostTitle("");
      setPostBody("");
      setPostFiles([]);
      setWriteOpen(false);
      setVisibleCount(GUILD_BOARD_PAGE_SIZE);
      await loadPosts();
    } catch (error) {
      if (imagePaths.length) await removeBoardImages(imagePaths);
      alert(`게시글 등록 실패: ${error.message}`);
    } finally {
      setPosting(false);
    }
  };

  const createComment = async () => {
    if (!selectedPost || commenting) return;
    const cleanBody = commentBody.trim();
    if (!cleanBody && commentFiles.length === 0) return alert("댓글 내용이나 사진을 하나 이상 입력해 주세요.");
    setCommenting(true);
    let imagePaths = [];
    try {
      imagePaths = await uploadBoardImages(currentUser.authUserId, `comments/${selectedPost.author_auth_id}`, commentFiles);
      const { error } = await supabase.from("guild_board_comments").insert({
        post_id: selectedPost.id,
        body: cleanBody,
        author_id: currentUser.id,
        author_nickname: currentUser.gameNickname,
        image_paths: imagePaths,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setCommentBody("");
      setCommentFiles([]);
      await loadComments(selectedPost.id);
      await loadPosts();
    } catch (error) {
      if (imagePaths.length) await removeBoardImages(imagePaths);
      alert(`댓글 등록 실패: ${error.message}`);
    } finally {
      setCommenting(false);
    }
  };

  const deleteComment = async (comment) => {
    if (!canDelete(comment.author_id)) return;
    const { error } = await supabase.from("guild_board_comments").delete().eq("id", comment.id);
    if (error) return alert(`댓글 삭제 실패: ${error.message}`);
    await removeBoardImages(comment.image_paths);
    await loadComments(selectedPost.id);
    await loadPosts();
  };

  const deletePost = async (post) => {
    if (!canDelete(post.author_id)) return;
    const { data: commentRows, error: commentsError } = await supabase.from("guild_board_comments").select("image_paths").eq("post_id", post.id);
    if (commentsError) return alert(`댓글 사진 확인 실패: ${commentsError.message}`);
    const commentImagePaths = (commentRows || []).flatMap((row) => parseBoardImagePaths(row.image_paths));
    const { error } = await supabase.from("guild_board_posts").delete().eq("id", post.id);
    if (error) return alert(`게시글 삭제 실패: ${error.message}`);
    await removeBoardImages([...parseBoardImagePaths(post.image_paths), ...commentImagePaths]);
    setSelectedPost(null);
    setComments([]);
    await loadPosts();
  };

  if (selectedPost) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Guild Board"
          title="자유게시판"
          desc="게시글과 댓글의 작성자는 게임 닉네임으로 표시됩니다."
          action={<Button onClick={() => { setSelectedPost(null); setComments([]); }} variant="secondary">목록으로</Button>}
        />
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-semibold tracking-tight text-zinc-950">{selectedPost.title}</h2>
              <div className="mt-2 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-800">{resolveNickname(selectedPost.author_id, selectedPost.author_nickname)}</span>
                <span className="mx-2">·</span>{new Date(selectedPost.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
            {canDelete(selectedPost.author_id) && <DeleteButton onConfirm={() => deletePost(selectedPost)}>글 삭제</DeleteButton>}
          </div>
          {selectedPost.body && <div className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700">{selectedPost.body}</div>}
          <BoardStoredImages paths={selectedPost.image_paths} />
        </article>

        <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-zinc-950">댓글 {comments.length}</h3></div>
          <div className="mt-4 space-y-3">
            {commentsLoading ? <div className="rounded-xl bg-zinc-50 p-5 text-center text-sm text-zinc-400">댓글 불러오는 중...</div> : comments.length === 0 ? <div className="rounded-xl bg-zinc-50 p-5 text-sm text-zinc-400">첫 댓글을 작성해 주세요.</div> : comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-500"><span className="font-semibold text-zinc-900">{resolveNickname(comment.author_id, comment.author_nickname)}</span><span className="mx-2">·</span>{new Date(comment.created_at).toLocaleString("ko-KR")}</div>
                    {comment.body && <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700">{comment.body}</div>}
                    <BoardStoredImages paths={comment.image_paths} />
                  </div>
                  {canDelete(comment.author_id) && <DeleteButton onConfirm={() => deleteComment(comment)} className="shrink-0 px-3 py-2 text-xs">삭제</DeleteButton>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <TextArea label="댓글" value={commentBody} onChange={setCommentBody} placeholder="댓글을 입력해 주세요" rows={4} />
            <div className="mt-3"><BoardImagePicker files={commentFiles} setFiles={setCommentFiles} label="댓글 사진 첨부" /></div>
            <div className="mt-4 flex justify-end"><Button onClick={createComment} disabled={commenting}>{commenting ? "등록 중" : "댓글 등록"}</Button></div>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Guild Board"
        title="자유게시판"
        desc="길드원끼리 자유롭게 글과 댓글을 남길 수 있습니다. 작성자는 모두 공개됩니다."
        action={<Button onClick={() => setWriteOpen(true)}><Plus size={16} /> 글쓰기</Button>}
      />
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {loading ? <div className="p-10 text-center text-sm text-zinc-400">게시글 불러오는 중...</div> : posts.length === 0 ? <div className="p-10 text-center text-sm text-zinc-400">아직 작성된 글이 없습니다.</div> : posts.map((post) => (
          <button key={post.id} type="button" onClick={() => setSelectedPost(post)} className="flex w-full items-center justify-between gap-4 border-b border-zinc-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-zinc-50 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-zinc-950 sm:text-base">{post.title}</div>
                {parseBoardImagePaths(post.image_paths).length > 0 && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">사진</span>}
              </div>
              <div className="mt-1 text-xs text-zinc-500"><span className="font-semibold text-zinc-700">{resolveNickname(post.author_id, post.author_nickname)}</span><span className="mx-2">·</span>{new Date(post.created_at).toLocaleString("ko-KR")}</div>
            </div>
            <div className="shrink-0 text-xs font-semibold text-zinc-500">댓글 {Number(post.guild_board_comments?.[0]?.count) || 0} <ChevronRight size={14} className="ml-1 inline" /></div>
          </button>
        ))}
      </div>
      {hasMore && <div className="mt-4"><Button onClick={() => setVisibleCount((prev) => prev + GUILD_BOARD_PAGE_SIZE)} variant="secondary">게시글 {GUILD_BOARD_PAGE_SIZE}개 더보기</Button></div>}

      {writeOpen && (
        <Modal title="자유게시판 글쓰기" onClose={() => setWriteOpen(false)}>
          <div className="grid gap-4">
            <Input label="제목" value={postTitle} onChange={setPostTitle} placeholder="제목을 입력해 주세요" />
            <TextArea label="내용" value={postBody} onChange={setPostBody} placeholder="내용을 입력해 주세요" rows={9} />
            <BoardImagePicker files={postFiles} setFiles={setPostFiles} label="게시글 사진 첨부" />
            <div className="flex justify-end"><Button onClick={createPost} disabled={posting}>{posting ? "등록 중" : "글 등록"}</Button></div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}



export default GuildBoardPage;
