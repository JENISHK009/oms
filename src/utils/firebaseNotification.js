import admin from 'firebase-admin';
import serviceAccount from '../../firebase.config.json' assert { type: 'json' };
import { pool } from '../config/index.js';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const sendNotificationToFirebase = async (
    title,
    body,
    token,
    userId,
    topic
) => {
    try {
        const message = {
            notification: {
                title,
                body,
                image:
                    process.env.FIREBASE_NOTIFICATION_IMAGE ||
                    'https://admin.flagoms.com/favicon.svg',
            },
        };

        topic ? (message.topic = topic) : (message.token = token);

        const response = await admin.messaging().send(message);
        console.log('Successfully sent message to Firebase:', response);

        const firebaseNotficationId = await saveFirebaseNotificationToFireStore(
            title,
            body,
            userId
        );
        if (!firebaseNotficationId)
            console.log('Something went wrong while sending notification');

        const notificationRecord = await saveFirebaseNotificationToPostgresDatabase(
            title,
            body,
            userId,
            firebaseNotficationId
        );
        if (!notificationRecord)
            console.log('Something went wrong while sending notification');

        return response;
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error(error);
    }
};

const saveFirebaseNotificationToPostgresDatabase = async (
    title,
    body,
    userId,
    firebaseId
) => {
    try {
        const notificationQuery = `
        INSERT INTO OMS."firebaseNotification" ("title", "body", "userId","imageUrl","firebaseId", "createdAt", "isRead")
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
        RETURNING id;
        `;

        const notificationResult = await pool.query(notificationQuery, [
            title,
            body,
            userId,
            process.env.FIREBASE_NOTIFICATION_IMAGE,
            firebaseId,
            false,
        ]);

        console.log(
            'saved Notification to postgres :>> ',
            notificationResult?.rows[0]?.id
        );
        return notificationResult?.rows[0]?.id;
    } catch (error) {
        throw new Error(error.message);
    }
};

const saveFirebaseNotificationToFireStore = async (title, body, userId) => {
    try {
        const createNotification = await db
            .collection(process.env.FIREBASE_COLLECTION || 'notification')
            .add({
                title,
                body,
                userId,
                image:
                    process.env.FIREBASE_NOTIFICATION_IMAGE ||
                    'https://admin.flagoms.com/favicon.svg',
                createdAt: new Date(),
            });
        console.log(
            'Notification added to Firestore with ID:',
            createNotification.id
        );
        return createNotification.id;
    } catch (error) {
        throw new Error(error.message);
    }
};

const deleteFirebaseNotification = async (notificationId) => {
    const docRef = db
        .collection(process.env.FIREBASE_COLLECTION || 'notification')
        .doc(notificationId);
    await docRef
        .delete()
        .then(() => {
            console.log('Firebase notifiction Document deleted successfully');
        })
        .catch((error) => {
            console.error('error while deleting firebase notification:', error);
        });

    return true;
};

const firebaseSubscribeToMultipleTopics = async (registrationToken, topics) => {
    try {
        const promises = topics?.map((topic) =>
            admin.messaging().subscribeToTopic(registrationToken, topic)
        );

        const responses = await Promise.all(promises);
        if (
            responses &&
            Array.isArray(responses) &&
            responses.length > 0 &&
            !responses[0]?.successCount
        )
            throw new Error('Failed to Subscribe all Topics');
        console.log('Successfully subscribed to all topics:', responses);
        return responses;
    } catch (error) {
        console.error('Error subscribing to topics:', error.message);
        throw new Error(error.message);
    }
};

const firebaseUnsubscribeFromTopics = async (registrationTokens, topics) => {
    try {
        const unsubscribePromises = topics?.map(topic =>
            admin.messaging().unsubscribeFromTopic(registrationTokens, topic)
        );
        const responses = await Promise.all(unsubscribePromises);
        if (
            responses &&
            Array.isArray(responses) &&
            responses?.length > 0 &&
            !responses[0]?.successCount
        )
            throw new Error('Failed to Unsubscribe all Topics');
        console.log(`Successfully unsubscribed from topic:`, responses);
        return responses
    } catch (error) {
        console.error('Error while unsubscribing from topics:', error);
        throw new Error(error.message);
    }
};
// sendNotificationToFirebase("Welcome", "Thanks for joining our app. Here is your welcome message", "cDT05fsF5SAQjIX-ioWx9N:APA91bE-O8c2dD7qhTFp2hKQ6kByFJ6JGEo83nSFS5M9He6PgHvg3OPYkFclQcc3B-jFYetCeBNF5ibB6uEs3NTuePE_4oBzu3zIWjIwtCeOeDK-rbc-cZy0aI7rkzI6Dgrz3-kaw4oG", 196, "news")

// firebaseSubscribeToMultipleTopics("drm6icjjf8AqJh0FxVoj9u:APA91bHk43nu-Rkui-V72g3gfyxmRryZrPlPue4BLaFt4nqz_3N2k5WPOTiObpjGwdoQQ2__Sac51sKq71Hw1svcmIEWniC3m1S6wKdsD3y1aMV7sa3mZ2OvLnCxRVZVDMJ5iYvIzGSx", ["cricket"])


// let fcmToken = "cDT05fsF5SAQjIX-ioWx9N:APA91bE-O8c2dD7qhTFp2hKQ6kByFJ6JGEo83nSFS5M9He6PgHvg3OPYkFclQcc3B-jFYetCeBNF5ibB6uEs3NTuePE_4oBzu3zIWjIwtCeOeDK-rbc-cZy0aI7rkzI6Dgrz3-kaw4oG"
// let topics = ["sport5", "cricket", "electronics"]
// unsubscribeFromTopics(fcmToken, topics)

export {
    sendNotificationToFirebase,
    deleteFirebaseNotification,
    firebaseSubscribeToMultipleTopics,
    firebaseUnsubscribeFromTopics
};
