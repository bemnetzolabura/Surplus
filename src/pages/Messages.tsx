import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeDollarSign, CheckCircle2, CreditCard, Info, MessageSquare, Package, Send, ShieldCheck, XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { formatETB, firstImage, timeAgo } from '../lib/format';
import { Avatar, EmptyState, Modal, PageLoader } from '../components/ui';

function OfferBubble({ m, me, iAmSeller, onRespond, busy, offer }: {
  m: any; me?: string; iAmSeller: boolean;
  onRespond: (messageId: string, action: 'accept' | 'decline') => void;
  busy: boolean;
  offer: { qty: number; p: number; status: string; transaction_id?: string; listing_id: string };
}) {
  const mine = m.sender_id === me;
  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    ACCEPTED: 'bg-emerald-100 text-emerald-800',
    DECLINED: 'bg-stone-200 text-stone-600',
  };
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl border-2 shadow-sm overflow-hidden ${mine ? 'border-gold-400 bg-gold-100/60 rounded-br-md' : 'border-gold-300 bg-white rounded-bl-md'}`}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <BadgeDollarSign size={16} className="text-gold-600" />
            <p className="text-xs font-extrabold uppercase tracking-wide text-gold-700">Price offer</p>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[offer.status] || statusColors.PENDING}`}>
              {offer.status}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold text-navy-900">
            {Number(offer.qty).toLocaleString()} units × {formatETB(offer.p)}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            Total: <b className="text-navy-800">{formatETB(Math.round(offer.qty * offer.p * 100) / 100)}</b> via escrow
          </p>
          <p className={`text-[10px] mt-1.5 ${mine ? 'text-stone-400' : 'text-stone-400'}`}>{timeAgo(m.created_at)}</p>

          {offer.status === 'PENDING' && iAmSeller && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => onRespond(m.id, 'accept')} disabled={busy} className="btn btn-navy !py-1.5 !px-3.5 text-xs flex-1">
                <CheckCircle2 size={13} /> Accept
              </button>
              <button onClick={() => onRespond(m.id, 'decline')} disabled={busy} className="btn btn-ghost !py-1.5 !px-3.5 text-xs flex-1 text-red-600 hover:!bg-red-50">
                <XCircle size={13} /> Decline
              </button>
            </div>
          )}
          {offer.status === 'PENDING' && mine && !iAmSeller && (
            <p className="mt-2.5 text-[11px] text-stone-500 italic">Waiting for the seller to respond…</p>
          )}
          {offer.status === 'ACCEPTED' && offer.transaction_id && !iAmSeller && (
            <Link to={`/checkout/${offer.transaction_id}`} className="btn btn-navy !py-2 w-full mt-3 text-xs">
              <CreditCard size={13} /> Pay {formatETB(Math.round(offer.qty * offer.p * 100) / 100)} via escrow
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { profile, token, loading: authLoading } = useAuth();
  const [convos, setConvos] = useState<any[]>([]);
  const [convosLoaded, setConvosLoaded] = useState(false);
  const [thread, setThread] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerQty, setOfferQty] = useState(1);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerBusy, setOfferBusy] = useState('');
  const [offerError, setOfferError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConvos = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/conversations', { token });
      setConvos(d || []);
    } catch { /* ignore */ } finally {
      setConvosLoaded(true);
    }
  }, [token]);

  const loadThread = useCallback(async (cid: string) => {
    if (!token) return;
    try {
      const d = await apiFetch(`/api/messages?conversation_id=${cid}`, { token });
      setThread(d);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate('/auth?redirect=/messages');
      return;
    }
    loadConvos();
    const t = setInterval(loadConvos, 6000);
    return () => clearInterval(t);
  }, [token, authLoading, loadConvos, navigate]);

  useEffect(() => {
    if (!conversationId || !token) return;
    loadThread(conversationId);
    const t = setInterval(() => loadThread(conversationId), 3500);
    return () => clearInterval(t);
  }, [conversationId, token, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length]);

  const send = async () => {
    if (!draft.trim() || !conversationId || sending) return;
    setSending(true);
    try {
      await apiFetch('/api/messages', { method: 'POST', body: { conversation_id: conversationId, content: draft.trim() }, token });
      setDraft('');
      await loadThread(conversationId);
      loadConvos();
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const sendOffer = async () => {
    if (!thread?.listing?.id) return;
    const qty = Number(offerQty);
    const price = Number(offerPrice);
    if (!(qty > 0) || !(price > 0)) {
      setOfferError('Enter a valid quantity and price.');
      return;
    }
    setOfferBusy('send');
    setOfferError('');
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: { conversation_id: conversationId, offer: { quantity: qty, unit_price: price, listing_id: thread.listing.id } },
        token,
      });
      setOfferOpen(false);
      await loadThread(conversationId!);
      loadConvos();
    } catch (e: any) {
      setOfferError(e.message);
    } finally {
      setOfferBusy('');
    }
  };

  const respondOffer = async (messageId: string, action: 'accept' | 'decline') => {
    setOfferBusy(messageId + action);
    try {
      await apiFetch('/api/offers', { method: 'POST', body: { action, message_id: messageId }, token });
      await loadThread(conversationId!);
      loadConvos();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setOfferBusy('');
    }
  };

  if (authLoading || (!convosLoaded && token)) return <PageLoader label="Loading conversations…" />;

  const me = profile?.id;
  const listVisible = !conversationId;
  const iAmBuyer = thread?.conversation?.buyer_id === me;
  const listingActive = thread?.listing?.status === 'ACTIVE';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 8.5rem)' }}>
        <div className="grid md:grid-cols-[340px_1fr] h-full">
          {/* Conversation list */}
          <div className={`border-r border-stone-100 flex-col min-h-0 ${listVisible ? 'flex' : 'hidden md:flex'}`}>
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="font-extrabold text-navy-900 text-lg flex items-center gap-2">
                <MessageSquare size={19} /> Messages
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">Negotiate in the chat with binding price offers — phone numbers stay hidden.</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convos.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No conversations yet"
                  message="Open any listing and tap 'Message seller' to start negotiating."
                  action={<Link to="/browse" className="btn btn-navy">Browse materials</Link>}
                />
              ) : (
                convos.map((c) => {
                  const active = c.id === conversationId;
                  return (
                    <button key={c.id} onClick={() => navigate(`/messages/${c.id}`)} className={`w-full text-left px-4 py-3.5 border-b border-stone-50 flex items-start gap-3 transition-colors ${active ? 'bg-navy-50' : 'hover:bg-stone-50'}`}>
                      <Avatar name={c.other?.company_name || c.other?.full_name} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm text-navy-900 truncate">{c.other?.company_name || c.other?.full_name || 'Trader'}</p>
                          <span className="text-[10px] text-stone-400 shrink-0">{timeAgo(c.last_message_at)}</span>
                        </div>
                        <p className="text-[11px] text-gold-700 font-semibold truncate mt-0.5">
                          <Package size={10} className="inline mr-1 -mt-0.5" />{c.listing?.title || 'General inquiry'}
                        </p>
                        <p className="text-xs text-stone-500 truncate mt-0.5">
                          {c.last_message?.message_type === 'OFFER' ? 'Price offer sent' : c.last_message?.message_type === 'SYSTEM' ? '[update]' : c.last_message?.content || 'Start the conversation'}
                        </p>
                      </div>
                      {(c.my_unread || 0) > 0 && (
                        <span className="mt-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.my_unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread */}
          <div className={`flex-col min-h-0 ${conversationId ? 'flex' : 'hidden md:flex'}`}>
            {!conversationId ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState icon={MessageSquare} title="Select a conversation" message="Choose a chat from the left to read, reply or send a price offer." />
              </div>
            ) : !thread ? (
              <PageLoader label="Opening chat…" />
            ) : (
              <>
                <div className="px-4 sm:px-5 py-3.5 border-b border-stone-100 flex items-center gap-3">
                  <button onClick={() => navigate('/messages')} className="md:hidden w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center">
                    <ArrowLeft size={17} />
                  </button>
                  <Avatar name={thread.other?.company_name || thread.other?.full_name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-navy-900 truncate">{thread.other?.company_name || thread.other?.full_name || 'Trader'}</p>
                    {thread.other?.kyc_status === 'VERIFIED' && (
                      <p className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1">
                        <ShieldCheck size={11} /> KYC verified trader
                      </p>
                    )}
                  </div>
                  {iAmBuyer && listingActive && (
                    <button
                      onClick={() => {
                        setOfferQty(1);
                        setOfferPrice(String(thread.listing.price_per_unit));
                        setOfferError('');
                        setOfferOpen(true);
                      }}
                      className="btn btn-gold !py-2 !px-3.5 text-xs shrink-0"
                    >
                      <BadgeDollarSign size={14} /> Make offer
                    </button>
                  )}
                  {thread.listing && (
                    <Link to={`/listing/${thread.listing.id}`} className="hidden sm:flex items-center gap-2.5 bg-sand-50 hover:bg-navy-50 border border-stone-200 rounded-xl px-3 py-2 transition-colors max-w-[240px]">
                      {firstImage(thread.listing.images) ? (
                        <img src={firstImage(thread.listing.images)!} alt="" className="w-10 h-8 rounded-md object-cover" />
                      ) : (
                        <div className="w-10 h-8 rounded-md bg-navy-100" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-navy-900 truncate">{thread.listing.title}</p>
                        <p className="text-[10px] text-gold-700 font-bold">{formatETB(thread.listing.price_per_unit)} / {thread.listing.unit}</p>
                      </div>
                    </Link>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 bg-sand-50/60">
                  {thread.messages.length === 0 && (
                    <div className="text-center text-xs text-stone-400 py-6">
                      Say selam — introduce yourself, negotiate with price offers, then pay through escrow.
                    </div>
                  )}
                  {thread.messages.map((m: any) => {
                    const mine = m.sender_id === me;
                    if (m.message_type === 'SYSTEM') {
                      return (
                        <div key={m.id} className="flex justify-center">
                          <span className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-stone-500 bg-white border border-stone-200 rounded-full px-3.5 py-1.5 max-w-[85%] text-center shadow-sm">
                            <Info size={11} className="mt-0.5 shrink-0 text-navy-400" /> {m.content}
                          </span>
                        </div>
                      );
                    }
                    if (m.message_type === 'OFFER') {
                      let offer = null;
                      try { offer = JSON.parse(m.content); } catch { /* corrupt */ }
                      if (!offer) return null;
                      return (
                        <OfferBubble
                          key={m.id}
                          m={m}
                          me={me}
                          iAmSeller={thread.conversation.seller_id === me}
                          onRespond={respondOffer}
                          busy={offerBusy === m.id + 'accept' || offerBusy === m.id + 'decline'}
                          offer={offer}
                        />
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${mine ? 'bg-navy-800 text-white rounded-br-md' : 'bg-white text-stone-700 border border-stone-100 rounded-bl-md'}`}>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`text-[10px] mt-1 text-right ${mine ? 'text-navy-200' : 'text-stone-400'}`}>
                            {timeAgo(m.created_at)}{mine ? (m.is_read ? ' · Read' : ' · Sent') : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="p-3.5 border-t border-stone-100 bg-white">
                  <div className="flex items-end gap-2.5">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Write a message… (Enter to send)"
                      rows={1}
                      className="input !rounded-xl resize-none !py-3"
                    />
                    <button onClick={send} disabled={sending || !draft.trim()} className="btn btn-navy !rounded-xl !px-4 !py-3 shrink-0">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Offer modal */}
      <Modal open={offerOpen} onClose={() => offerBusy !== 'send' && setOfferOpen(false)} title="Make a price offer">
        {thread?.listing && (
          <div className="space-y-4">
            <div className="flex gap-3.5">
              {firstImage(thread.listing.images) && <img src={firstImage(thread.listing.images)!} alt="" className="w-20 h-16 rounded-lg object-cover" />}
              <div>
                <p className="font-bold text-navy-900 text-sm leading-snug line-clamp-2">{thread.listing.title}</p>
                <p className="text-xs text-stone-500 mt-1">Asking: {formatETB(thread.listing.price_per_unit)} / {thread.listing.unit}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1 block">Quantity ({thread.listing.unit})</label>
                <input type="number" min={1} max={Number(thread.listing.quantity)} value={offerQty} onChange={(e) => setOfferQty(Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1 block">Your price / unit (ETB)</label>
                <input type="number" min={1} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="input" />
              </div>
            </div>
            <div className="bg-sand-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-stone-500">Offer total</span><b className="text-navy-900">{formatETB(Math.round(Number(offerQty || 0) * Number(offerPrice || 0) * 100) / 100)}</b></div>
              <p className="text-[11px] text-stone-400 leading-relaxed">If the seller accepts, a binding order is created at this price and you pay into escrow. Commission is paid by the seller.</p>
            </div>
            {offerError && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{offerError}</div>}
            <button onClick={sendOffer} disabled={offerBusy === 'send'} className="btn btn-gold w-full !py-3">
              {offerBusy === 'send' ? 'Sending offer…' : 'Send binding offer to seller'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
