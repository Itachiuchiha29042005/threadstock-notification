const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const messaging = admin.messaging();

console.log('ThreadStock Notification Server started!');

// Watch for new notifications in ALL enterprises
db.collectionGroup('notifications')
  .where('status', '==', 'pending')
  .onSnapshot(async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const data = change.doc.data();
        const token = data.to;
        const title = data.title;
        const body = data.body;

        if (!token || !title || !body) continue;

        try {
          // Send FCM notification
          await messaging.send({
            token: token,
            notification: {
              title: title,
              body: body,
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'stock_updates',
              },
            },
          });

          // Mark as sent
          await change.doc.ref.update({ status: 'sent' });
          console.log(`Notification sent to ${token}`);

        } catch (error) {
          console.error('Error sending notification:', error.message);
          // Mark as failed
          await change.doc.ref.update({ 
            status: 'failed',
            error: error.message 
          });
        }
      }
    }
  });

// Keep server alive
setInterval(() => {
  console.log('Server running... ' + new Date().toISOString());
}, 60000);
