import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { DEV_BYPASS_AUTH } from '@/lib/dev-config';

type ApprovalAction = 'approve' | 'reject';

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function createUserSupabaseClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Chybí Supabase konfigurace.');
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const coachId = stringValue(body.coachId);
    const action = stringValue(body.action) as ApprovalAction | null;
    const rejectionReason = stringValue(body.reason) ?? 'Zamítnuto v administraci Team VYS.';

    if (!coachId) return NextResponse.json({ error: 'Chybí coachId.' }, { status: 400 });
    if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'Neplatná akce.' }, { status: 400 });

    const token = DEV_BYPASS_AUTH
      ? undefined
      : request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

    if (!DEV_BYPASS_AUTH && !token) {
      return NextResponse.json({ error: 'Chybí admin přihlášení.' }, { status: 401 });
    }

    const supabase = createUserSupabaseClient(token);

    // Call the security-definer RPC — the DB checks admin role internally
    const rpcName = action === 'approve' ? 'teamvys_approve_coach' : 'teamvys_reject_coach';
    const rpcArgs =
      action === 'approve'
        ? { p_coach_id: coachId }
        : { p_coach_id: coachId, p_reason: rejectionReason };

    const { data, error } = await supabase.rpc(rpcName, rpcArgs);
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Trenérský profil nebyl nalezen nebo nebyl změněn.' }, { status: 404 });
    }

    // On approval, notify the coach by e-mail (best-effort, never blocks the response).
    if (action === 'approve' && token) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';
      try {
        await fetch(`${apiBase}/api/admin/coaches/${encodeURIComponent(coachId)}/notify-approved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      } catch (notifyError) {
        console.error('Coach approval e-mail notification failed:', notifyError);
      }
    }

    return NextResponse.json({ coach: rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Žádost trenéra se nepodařilo zpracovat.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}