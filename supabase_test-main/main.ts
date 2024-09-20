import { createClient } from 'npm:@supabase/supabase-js@2';

import admin from "npm:firebase-admin@12.0.0";
import { TokenMessage, getMessaging } from "npm:firebase-admin/messaging";
// import serviceAccount from './fcm_service_account.json' with { type: 'json' }




interface TripNotification {
  trip_id: string
  user_id: string
  seen: boolean
}

interface Trip {
  id: string
  driver_id: string
  request_id: string
  status:string
  scheduled_at:Date
  started_at:Date
  completed_at:Date
  driver_location:{
    lat: number
    long: number
  }
}

interface Driver {
  id: string
  name: string
  phone_number: string
  
  fcm_token: string
}

interface User {
  id: string
  name: string
  phone_number: string
  notify_distance_in_km:number
  fcm_token: string
}

interface Requests {
  trip_id: string
  user_id: string
  seen: boolean
}


interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: TripNotification
  schema: 'public'
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  if(req.headers.get('content-type') !== 'application/json') {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if(req.headers.get('secret') !== 'garbage_doctor') {
    return new Response(JSON.stringify({ error: 'Invalid secret' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!req.body) {
    return new Response(JSON.stringify({ error: 'No body' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const payload: WebhookPayload = await req.json()

  const user = await supabase
  .from('users')
  .select('*')
  .eq('id', payload.record.user_id)
  .single() as { data: User }

const fcmToken = user.data!.fcm_token as string

if (!fcmToken) {
  return new Response(JSON.stringify({ error: 'No FCM token' }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

  const trip = await supabase
    .from('trips')
    .select('*')
    .eq('id', payload.record.trip_id)
    .single() as { data: Trip }

 const driver = await supabase.from('drivers').select('*').eq('id', trip.data!.driver_id).single() as { data: Driver };

 const request = await supabase.from('requests').select('*').eq('id', trip.data!.request_id).single() as { data: Requests };
const notify_distance_in_km = user.data!.notify_distance_in_km;

await sendTripNotification({
  token: fcmToken,
  data: {
    key:"trip_notification",
    trip_id: payload.record.trip_id,
    driver_id: driver.data!.id,
    driver_name: driver.data!.name,
    request_json: JSON.stringify(request.data)  
   
  },
  notification: {
    title: "Garbage Truck is near you around " + notify_distance_in_km + " km",
    body: "Driver " + driver.data!.name + "is near you around " + notify_distance_in_km + " km",
  }

});
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

 


const firebase_app = ()=>{
  return admin.initializeApp({
    credential:admin.credential.cert(JSON.stringify(JSON.stringify(Deno.env.get("FIREBASE_SECRET")))),
    projectId:serviceAccount.project_id,
   
  });
  }

const sendTripNotification = async (payload: TokenMessage) => {
 
  const fapp = firebase_app();
  console.log("App initialized");
  console.log(fapp);
  const fcm = getMessaging(fapp);
  console.log("Got Messaging");
  await fcm.send(payload);
  console.log("Sent Messaging");
};
