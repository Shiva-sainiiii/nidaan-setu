import "server-only";
import { one, q } from "./db";
import type { User } from "./session";

// ---------------------------------------------------------------- doctor
export async function doctorView(u: User) {
  const referrals = await q(
    `select r.id, r.code, r.status, r.priority, r.on_temp_medication, r.test_type_id, t.name_en as test_name,
            p.display_name as patient_name, p.phone, r.original_slot_at, r.accepted_slot_at,
            h.short_name as lab_name, r.created_at, r.updated_at, r.expires_at,
            case when r.test_done_at is not null
                 then tb.ist_date(r.original_slot_at) - tb.ist_date(r.test_done_at) end as days_saved,
            (select count(*) from tb.referral_recipients rr where rr.referral_id = r.id)::int as labs_notified,
            r.bundle_id, b.code as bundle_code, r.consent_status
       from tb.referrals r
       left join tb.referral_bundles b on b.id = r.bundle_id
       join tb.patients p on p.id = r.patient_id
       join tb.test_types t on t.id = r.test_type_id
       left join tb.hospitals h on h.id = r.accepted_hospital_id
      where r.from_hospital_id = $1
      order by r.created_at desc`,
    [u.hospital_id],
  );
  const stats = await one(
    `select count(*) filter (where status in ('open','accepted','patient_confirmed','arrived','test_done'))::int as active,
            count(*) filter (where test_done_at is not null)::int as done,
            coalesce(sum(tb.ist_date(original_slot_at) - tb.ist_date(test_done_at)) filter (where test_done_at is not null), 0)::int as days_saved,
            (select count(*) from tb.home_queue where hospital_id = $1 and status = 'released')::int as slots_released
       from tb.referrals where from_hospital_id = $1`,
    [u.hospital_id],
  );
  return { referrals, stats };
}

export async function testsFor(hospitalId: string) {
  return q(
    `select t.id, t.name_en, ht.current_wait_days
       from tb.test_types t left join tb.hospital_tests ht on ht.test_type_id = t.id and ht.hospital_id = $1
      order by t.id = 'MRI' desc, t.id`,
    [hospitalId],
  );
}

export async function lookupPatient(u: User, phone: string, tests: string[]) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  const patient = await one<{ id: string; display_name: string; age: number; abha_id: string | null }>(
    `select id, display_name, age, abha_id from tb.patients where phone = $1`,
    [digits],
  );
  if (!patient) return { patient: null, slots: [], active: [] };
  const slots = await q<{ test: string; slot_at: string; position: number }>(
    `select distinct on (test_type_id) test_type_id as test, slot_at, position from tb.home_queue
      where hospital_id = $1 and test_type_id = any($2) and patient_id = $3 and status = 'booked'
      order by test_type_id, slot_at`,
    [u.hospital_id, tests, patient.id],
  );
  const active = await q<{ test: string; code: string; id: number }>(
    `select test_type_id as test, code, id from tb.referrals where patient_id = $1 and test_type_id = any($2)
        and status not in ('closed','expired','cancelled')`,
    [patient.id, tests],
  );
  return { patient, slots, active };
}

export async function previewLabs(u: User, tests: string[], km: number) {
  return q(
    `select h.id, h.short_name, h.kind, round(tb.km(a.lat, a.lng, h.lat, h.lng)::numeric, 1) as distance_km,
            count(*)::int as n,
            jsonb_agg(jsonb_build_object('test', ht.test_type_id, 'is_free', ht.is_free, 'price_inr', ht.price_inr,
                                         'wait', ht.current_wait_days) order by ht.test_type_id) as tests
       from tb.hospitals a
       join tb.hospital_tests ht on ht.test_type_id = any($2)
       join tb.hospitals h on h.id = ht.hospital_id
      where a.id = $1 and h.id <> a.id and tb.km(a.lat, a.lng, h.lat, h.lng) <= $3
      group by h.id, h.short_name, h.kind, a.lat, a.lng, h.lat, h.lng
      order by count(*) desc, distance_km`,
    [u.hospital_id, tests, km],
  );
}

// ---------------------------------------------------------------- referral detail
export async function referralView(u: User, id: number) {
  const r = await one<Record<string, unknown> & { from_hospital_id: string; accepted_hospital_id: string | null }>(
    `select r.*, t.name_en as test_name, t.name_hi as test_name_hi, t.prep_en, t.prep_hi, t.bring_en, t.bring_hi,
            p.display_name as patient_name, p.phone as patient_phone, p.abha_id, p.age as patient_age,
            a.name as from_name, a.short_name as from_short, d.name as doctor_name,
            h.name as lab_name, h.short_name as lab_short, h.address_en as lab_address, h.address_hi as lab_address_hi,
            h.phone as lab_phone, h.lat as lab_lat, h.lng as lab_lng,
            ht.is_free as lab_is_free, ht.price_inr as lab_price,
            rr.distance_km as lab_distance_km,
            case when r.test_done_at is not null
                 then tb.ist_date(r.original_slot_at) - tb.ist_date(r.test_done_at) end as days_saved,
            tb.score(r.priority, r.on_temp_medication, r.created_at, null) as score,
            (select code from tb.referral_bundles where id = r.bundle_id) as bundle_code,
            tb.app_now() as now
       from tb.referrals r
       join tb.test_types t on t.id = r.test_type_id
       join tb.patients p on p.id = r.patient_id
       join tb.hospitals a on a.id = r.from_hospital_id
       join tb.demo_users d on d.id = r.doctor_id
       left join tb.hospitals h on h.id = r.accepted_hospital_id
       left join tb.hospital_tests ht on ht.hospital_id = r.accepted_hospital_id and ht.test_type_id = r.test_type_id
       left join tb.referral_recipients rr on rr.referral_id = r.id and rr.hospital_id = r.accepted_hospital_id
      where r.id = $1`,
    [id],
  );
  if (!r) return null;
  const allowed =
    u.role === "dho" ||
    (u.role === "doctor" && r.from_hospital_id === u.hospital_id) ||
    (u.role === "lab" && r.accepted_hospital_id === u.hospital_id);
  if (!allowed) return null;

  const [recipients, audit, report, siblings, offers] = await Promise.all([
    q(
      `select rr.hospital_id, h.short_name, rr.distance_km, rr.response, rr.responded_at, rr.round,
              ht.is_free, ht.price_inr
         from tb.referral_recipients rr
         join tb.hospitals h on h.id = rr.hospital_id
         join tb.referrals r on r.id = rr.referral_id
         left join tb.hospital_tests ht on ht.hospital_id = rr.hospital_id and ht.test_type_id = r.test_type_id
        where rr.referral_id = $1 order by rr.distance_km`,
      [id],
    ),
    q(
      `select id, at, actor_name, actor_role, action, from_status, to_status, details
         from tb.audit_log where referral_id = $1 order by id`,
      [id],
    ),
    one(
      `select id, filename, reported_by_name, reg_no, uploaded_at, length(content)::int as bytes
         from tb.reports where referral_id = $1`,
      [id],
    ),
    q(
      `select s.id, s.code, s.test_type_id, t.name_en as test_name, s.status, s.accepted_slot_at, h.short_name as lab_name, b.code as bundle_code
         from tb.referrals me
         join tb.referrals s on s.bundle_id = me.bundle_id and s.id <> me.id
         join tb.test_types t on t.id = s.test_type_id
         join tb.referral_bundles b on b.id = s.bundle_id
         left join tb.hospitals h on h.id = s.accepted_hospital_id
        where me.id = $1 order by s.id`,
      [id],
    ),
    q(
      `select o.hospital_id, h.short_name, o.slot_at, o.distance_km, o.is_free, o.status, o.created_at, o.updated_at
         from tb.referral_offers o join tb.hospitals h on h.id = o.hospital_id
        where o.referral_id = $1 order by o.slot_at, o.distance_km`,
      [id],
    ),
  ]);
  return { referral: r, recipients, audit, report, siblings, offers };
}

// ---------------------------------------------------------------- lab desk
export async function labView(u: User) {
  const [incoming, missed, today, done] = await Promise.all([
    q(
      `select r.id, r.code, r.test_type_id, t.name_en as test_name, r.priority, r.on_temp_medication, r.note,
              rr.distance_km, rr.round, ht.is_free, ht.price_inr, ht.current_wait_days,
              r.expires_at, r.created_at, a.short_name as from_name,
              tb.score(r.priority, r.on_temp_medication, r.created_at, rr.distance_km) as score,
              r.bundle_id, b.code as bundle_code, r.offers_close_at,
              (select slot_at from tb.referral_offers o where o.referral_id = r.id and o.hospital_id = rr.hospital_id) as my_offer_at,
              (select count(*) from tb.referrals r2 where r2.bundle_id = r.bundle_id)::int as bundle_size,
              (select count(*) from tb.referrals r2 where r2.bundle_id = r.bundle_id and r2.status = 'open')::int as bundle_open
         from tb.referral_recipients rr
         join tb.referrals r on r.id = rr.referral_id
         join tb.test_types t on t.id = r.test_type_id
         join tb.hospitals a on a.id = r.from_hospital_id
         left join tb.referral_bundles b on b.id = r.bundle_id
         left join tb.hospital_tests ht on ht.hospital_id = rr.hospital_id and ht.test_type_id = r.test_type_id
        where rr.hospital_id = $1 and r.status = 'open' and (rr.response is null or rr.response = 'offered')
          and r.expires_at > tb.app_now()
          and r.consent_status in ('verbal', 'granted_sms')   -- never before consent
        order by (tb.score(r.priority, r.on_temp_medication, r.created_at, rr.distance_km)->>'total')::int desc,
                 r.created_at`,
      [u.hospital_id],
    ),
    q(
      `select r.id, r.code, r.test_type_id, r.priority, r.status, rr.response, h.short_name as winner, r.updated_at,
              r.selection->>'reason' as reason
         from tb.referral_recipients rr
         join tb.referrals r on r.id = rr.referral_id
         left join tb.hospitals h on h.id = r.accepted_hospital_id
        where rr.hospital_id = $1 and r.accepted_hospital_id is distinct from $1
          and (r.status <> 'open' or rr.response = 'declined')
          and r.updated_at > tb.app_now() - interval '6 hours'
        order by r.updated_at desc limit 10`,
      [u.hospital_id],
    ),
    q(
      `select r.id, r.code, r.test_type_id, t.name_en as test_name, r.priority, r.on_temp_medication, r.status,
              r.accepted_slot_at, a.short_name as from_name, r.note,
              (select code from tb.referral_bundles where id = r.bundle_id) as bundle_code
         from tb.referrals r
         join tb.test_types t on t.id = r.test_type_id
         join tb.hospitals a on a.id = r.from_hospital_id
        where r.accepted_hospital_id = $1 and r.status in ('accepted','patient_confirmed','arrived','test_done')
        order by r.accepted_slot_at`,
      [u.hospital_id],
    ),
    q(
      `select r.id, r.code, r.test_type_id, r.status, r.accepted_slot_at, a.short_name as from_name, rp.uploaded_at
         from tb.referrals r
         join tb.hospitals a on a.id = r.from_hospital_id
         left join tb.reports rp on rp.referral_id = r.id
        where r.accepted_hospital_id = $1 and r.status in ('report_sent','closed')
        order by r.updated_at desc limit 20`,
      [u.hospital_id],
    ),
  ]);
  return { incoming, missed, today, done };
}

export async function patientForLab(u: User, id: number) {
  return one(
    `select p.display_name, p.phone, p.abha_id, p.age
       from tb.referrals r join tb.patients p on p.id = r.patient_id
      where r.id = $1 and r.accepted_hospital_id = $2`,
    [id, u.hospital_id],
  );
}

// ---------------------------------------------------------------- home queue (Hospital A desk)
export async function queueView(u: User) {
  return q(
    `select hq.id, hq.test_type_id, t.name_en as test_name, hq.position, hq.slot_at, hq.status, hq.updated_at,
            p.display_name as patient_name, p2.display_name as released_to,
            (select r.code || '|' || coalesce(h.short_name, '') || '|' || r.status
               from tb.referrals r left join tb.hospitals h on h.id = r.accepted_hospital_id
              where r.original_queue_id = hq.id order by r.created_at desc limit 1) as referral
       from tb.home_queue hq
       join tb.patients p on p.id = hq.patient_id
       join tb.test_types t on t.id = hq.test_type_id
       left join tb.patients p2 on p2.id = hq.released_to_patient_id
      where hq.hospital_id = $1
      order by hq.test_type_id = 'MRI' desc, hq.test_type_id, hq.slot_at nulls last, hq.position`,
    [u.hospital_id],
  );
}

// ---------------------------------------------------------------- patient phone (simulated)
export async function phoneView(patientId: string | null) {
  const patients = await q<{ id: string; display_name: string; phone: string; last_at: string | null; n: number }>(
    `select p.id, p.display_name, p.phone, max(m.created_at) as last_at, count(m.id)::int as n
       from tb.patients p left join tb.messages m on m.patient_id = p.id
      group by p.id order by max(m.created_at) desc nulls last, p.display_name`,
  );
  const selected = patientId ?? (patients[0]?.n ? patients[0].id : "P-RAMESH");
  const messages = await q(
    `select m.id, m.direction, m.body_hi, m.body_en, m.created_at, r.patient_token
       from tb.messages m left join tb.referrals r on r.id = m.referral_id
      where m.patient_id = $1 order by m.id`,
    [selected],
  );
  return { patients, selected, messages };
}

// ---------------------------------------------------------------- public status page
export async function statusView(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return one(
    `select r.code, r.status, r.priority, r.consent_status, r.accepted_slot_at, r.original_slot_at, r.updated_at, r.test_done_at,
            split_part(p.display_name, ' ', 1) as first_name,
            t.name_en as test_en, t.name_hi as test_hi, t.prep_en, t.prep_hi, t.bring_en, t.bring_hi,
            a.name as from_name, d.name as doctor_name,
            h.name as lab_name, h.address_en as lab_address_en, h.address_hi as lab_address_hi,
            h.phone as lab_phone, h.lat as lab_lat, h.lng as lab_lng,
            ht.is_free as lab_is_free, ht.price_inr as lab_price,
            exists(select 1 from tb.audit_log l where l.referral_id = r.id and l.action = 'patient_confirmed') as confirmed,
            (select coalesce(jsonb_agg(jsonb_build_object('test_en', t2.name_en, 'test_hi', t2.name_hi, 'status', s.status,
                       'code', s.code, 'lab', h2.name, 'slot', s.accepted_slot_at) order by s.id), '[]'::jsonb)
               from tb.referrals s join tb.test_types t2 on t2.id = s.test_type_id
               left join tb.hospitals h2 on h2.id = s.accepted_hospital_id
              where s.bundle_id = r.bundle_id and s.id <> r.id) as siblings
       from tb.referrals r
       join tb.patients p on p.id = r.patient_id
       join tb.test_types t on t.id = r.test_type_id
       join tb.hospitals a on a.id = r.from_hospital_id
       join tb.demo_users d on d.id = r.doctor_id
       left join tb.hospitals h on h.id = r.accepted_hospital_id
       left join tb.hospital_tests ht on ht.hospital_id = r.accepted_hospital_id and ht.test_type_id = r.test_type_id
      where r.patient_token = $1`,
    [token],
  );
}

// ---------------------------------------------------------------- audit + DHO
export async function auditView(code: string | null) {
  return q(
    `select id, at, actor_name, actor_role, actor_hospital_id, referral_id, referral_code, action,
            from_status, to_status, details
       from tb.audit_log
      where ($1::text is null or referral_code ilike '%' || $1 || '%' or action ilike '%' || $1 || '%')
      order by id desc limit 300`,
    [code || null],
  );
}

export type DhoFilter = { test: string | null; days: number | null };

/** Parses ?test=MRI&days=7 (anything unknown → no filter). */
export function dhoFilter(sp: URLSearchParams): DhoFilter {
  const test = sp.get("test");
  const days = Number(sp.get("days"));
  return {
    test: test && /^[A-Z]{2,5}$/.test(test) ? test : null,
    days: [1, 7, 30].includes(days) ? days : null,
  };
}

// Filtered referral set used by every DHO number ($1 = test or null, $2 = days or null). Read-only.
const F = `f as (select * from tb.referrals
                   where ($1::text is null or test_type_id = $1)
                     and ($2::int is null or created_at >= tb.app_now() - make_interval(days => $2)))`;

export async function dhoView(filter: DhoFilter = { test: null, days: null }) {
  const args = [filter.test, filter.days];
  const kpi = await one(
    `with ${F}
     select count(*)::int as sent,
            (select count(distinct a.referral_id) from tb.audit_log a join f on f.id = a.referral_id where a.action = 'accepted')::int as accepted,
            count(*) filter (where test_done_at is not null)::int as tests_done,
            coalesce(percentile_cont(0.5) within group (order by tb.ist_date(original_slot_at) - tb.ist_date(test_done_at))
                     filter (where test_done_at is not null), 0)::float as median_days_saved,
            coalesce(round(avg(tb.ist_date(original_slot_at) - tb.ist_date(test_done_at)) filter (where test_done_at is not null), 1), 0)::float as avg_days_saved,
            coalesce(sum(tb.ist_date(original_slot_at) - tb.ist_date(test_done_at)) filter (where test_done_at is not null), 0)::int as total_days_saved,
            (select count(*) from tb.home_queue hq where hq.status = 'released'
                and hq.id in (select original_queue_id from f))::int as slots_released,
            count(*) filter (where status = 'expired')::int as expired,
            (select count(distinct bundle_id) from f where bundle_id is not null)::int as bundles,
            (select coalesce(sum(n_tests - n_labs), 0) from (
               select count(*) as n_tests, count(distinct accepted_hospital_id) as n_labs
                 from f where bundle_id is not null and accepted_hospital_id is not null group by bundle_id) x)::int as trips_saved,
            (select count(*) from tb.audit_log a join f on f.id = a.referral_id where a.action = 'no_show')::int as no_shows,
            (select count(*) from tb.audit_log a join f on f.id = a.referral_id where a.action = 'accepted')::int as bookings,
            count(*) filter (where consent_mode = 'sms')::int as sms_consent,
            count(*) filter (where consent_status = 'granted_sms')::int as sms_granted,
            count(*) filter (where on_temp_medication and test_done_at is null
                               and status not in ('cancelled','closed')
                               and coalesce(accepted_slot_at, original_slot_at) - created_at > interval '14 days')::int as temp_med_waiting_14d
       from f`,
    args,
  );
  const hospitals = await q(
    `with ${F}
     select h.id, h.name, h.short_name, h.kind, h.lat, h.lng,
            (select count(*) from f where f.from_hospital_id = h.id)::int as sent,
            (select count(*) from tb.referral_recipients rr join f on f.id = rr.referral_id where rr.hospital_id = h.id)::int as received,
            (select count(*) from tb.referral_recipients rr join f on f.id = rr.referral_id where rr.hospital_id = h.id and rr.response = 'accepted')::int as accepted,
            (select count(*) from tb.referral_recipients rr join f on f.id = rr.referral_id where rr.hospital_id = h.id and rr.response = 'declined')::int as declined,
            (select count(*) from tb.referral_offers o join f on f.id = o.referral_id where o.hospital_id = h.id)::int as offers,
            (select count(*) from f where f.accepted_hospital_id = h.id and f.test_done_at is not null)::int as tests_done,
            (select count(*) from f where f.accepted_hospital_id = h.id and tb.ist_date(f.accepted_at) = tb.ist_date(tb.app_now()))::int as accepted_today,
            (select count(*) from f where f.accepted_hospital_id = h.id and tb.ist_date(f.test_done_at) = tb.ist_date(tb.app_now()))::int as done_today,
            (select count(*) from tb.audit_log a join f on f.id = a.referral_id where a.action = 'no_show' and a.actor_hospital_id = h.id)::int as no_shows,
            (select round(avg(extract(epoch from (f.accepted_at - coalesce(f.consent_answered_at, f.created_at))) / 60)::numeric, 0)
               from f where f.accepted_hospital_id = h.id and f.accepted_at is not null)::int as avg_accept_min,
            (select round(avg(ht.current_wait_days)::numeric, 1) from tb.hospital_tests ht
              where ht.hospital_id = h.id and ($1::text is null or ht.test_type_id = $1))::float as wait_days,
            (select coalesce(jsonb_agg(jsonb_build_object('test', ht.test_type_id, 'is_free', ht.is_free, 'price_inr', ht.price_inr,
                                                          'wait', ht.current_wait_days) order by ht.test_type_id), '[]')
               from tb.hospital_tests ht where ht.hospital_id = h.id) as tests,
            exists (select 1 from tb.hospital_tests ht where ht.hospital_id = h.id and ($1::text is null or ht.test_type_id = $1)) as offers_test,
            exists (select 1 from tb.demo_users d where d.hospital_id = h.id and d.role = 'doctor') as is_referrer
       from tb.hospitals h order by h.id`,
    args,
  );
  // Live arrows: referrals booked and not yet closed (accepted … report_sent), grouped per route.
  const flows = await q(
    `with ${F}
     select f.from_hospital_id as "from", f.accepted_hospital_id as "to", count(*)::int as n,
            string_agg(f.code || ' ' || f.test_type_id, ', ' order by f.id) as codes
       from f where f.status in ('accepted','patient_confirmed','arrived','test_done','report_sent')
      group by 1, 2`,
    args,
  );
  const doctors = await q(
    `with ${F}
     select d.name, h.short_name, count(f.id)::int as referrals,
            count(f.id) filter (where f.priority = 'P1')::int as p1,
            count(f.id) filter (where f.on_temp_medication)::int as temp_med
       from tb.demo_users d join tb.hospitals h on h.id = d.hospital_id
       left join f on f.doctor_id = d.id
      where d.role = 'doctor' group by d.name, h.short_name`,
    args,
  );
  const waiting = await q(
    `with ${F}
     select f.code, t.name_en as test, a.short_name as from_name, f.priority, f.status, f.created_at,
            coalesce(f.accepted_slot_at, f.original_slot_at) as expected_at
       from f join tb.test_types t on t.id = f.test_type_id join tb.hospitals a on a.id = f.from_hospital_id
      where f.on_temp_medication and f.test_done_at is null and f.status not in ('cancelled','closed')
        and coalesce(f.accepted_slot_at, f.original_slot_at) - f.created_at > interval '14 days'
      order by f.created_at`,
    args,
  );
  const tests = await q(`select id, name_en, name_hi from tb.test_types order by id = 'MRI' desc, id`);
  return { kpi, hospitals, flows, doctors, waiting, tests, filter };
}

export async function clockOffsetHours(): Promise<number> {
  const r = await one<{ h: number }>(
    `select round(extract(epoch from offset_interval) / 3600)::int as h from tb.demo_clock where id = 1`,
  );
  return r?.h ?? 0;
}
