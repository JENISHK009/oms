import { pool } from '../config/index.js';
import { sendSuccess, deleteFirebaseNotification, firebaseSubscribeToMultipleTopics, firebaseUnsubscribeFromTopics } from '../utils/index.js';


const getAllNotificationsForUser = async (req, res) => {
    try {
        const userId = req?.currentUser?.id;

        const query = `
        SELECT id, "title", "body", "userId", "imageUrl", "createdAt", "isRead", "deletedAt", "firebaseId"
        FROM OMS."firebaseNotification"
        WHERE "userId" = $1 AND "deletedAt" IS NULL
        ORDER BY "createdAt" DESC;
      `;

        const result = await pool.query(query, [userId]);
        sendSuccess(res, null, result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

const getNotificationDetailById = async (req, res) => {
    try {
        const messageId = req?.query?.messageId;
        if (!messageId)
            res.status(400).json({ error: "MessageId is required" });

        const query = `SELECT id, "title", "body", "userId", "imageUrl", "createdAt", "isRead", "deletedAt", "firebaseId"
            FROM OMS."firebaseNotification"
            WHERE "id" = $1 AND "deletedAt" IS NULL;
        `;

        const checkMessage = await pool.query(query, [messageId]);
        if (!checkMessage?.rows[0])
            res.status(404).json({ error: "Message not found" });


        const deleteNotificationInFirebase = await deleteFirebaseNotification(checkMessage?.rows[0]?.firebaseId)
        if (!deleteNotificationInFirebase)
            res.status(500).json({ error: "Something went wrong while deleting Firebase notification" });

        const updateQuery = `UPDATE OMS."firebaseNotification"
            SET "isRead" = TRUE, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1 `;

        const result = await pool.query(updateQuery, [messageId]);
        if (result.rowCount === 0)
            res.status(404).json({ error: "Something went wrong while updating the message" });

        sendSuccess(res, "success", checkMessage?.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

const getFirebaseTopics = async (req, res) => {
    try {
        const currentUserId = req?.currentUser?.id

        const topicQuery = `SELECT * FROM OMS."firebaseTopic" WHERE "deletedAt" is null and "active" = true ORDER BY id desc;
        `;
        const result = await pool.query(topicQuery);

        const userSubscribedQuery = `
        select ut."topics" from oms."userTopic" ut where "userId" = $1;
        `;
        const userSubscribedTopics = await pool.query(userSubscribedQuery, [currentUserId]);
        sendSuccess(res, "Topics listed successfully", { topics: result?.rows, subscribedTopic: userSubscribedTopics?.rows[0]?.topics ? userSubscribedTopics?.rows[0]?.topics : [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

const subscribeFirebaseTopics = async (req, res) => {
    try {
        let { topicIds } = req.body;

        if (topicIds && !Array.isArray(topicIds))
            res.status(400).json({ error: "Firebase Topics are required" });
        const currentUserId = req?.currentUser?.id

        const userQuery = `
        select * from OMS."users"  where "id" = $1;
    `;
        const userData = await pool.query(userQuery, [currentUserId]);

        const subscribedTopicQuery = `
            select array_agg(ft."name") as "firebaseTopics" from oms."userTopic" ut 
            left join OMS."firebaseTopic" ft 
            on ft.id = any(ut."topics"::integer[])
            where "userId" = $1;    
        `;
        const subscribedTopic = await pool.query(subscribedTopicQuery, [currentUserId]);

        if (userData?.rows?.length > 0 && userData?.rows[0]?.firebaseToken && subscribedTopic?.rows?.length > 0 && subscribedTopic?.rows[0]?.firebaseTopics?.length > 0 && subscribedTopic?.rows[0]?.firebaseTopics[0]) {
            console.log('new Date() before unsubscribe :>> ', new Date());
            await firebaseUnsubscribeFromTopics(userData?.rows[0]?.firebaseToken, subscribedTopic?.rows[0]?.firebaseTopics)
            console.log('new Date() after unsubscribe :>> ', new Date());
        }

        const upsertQuery = `
            INSERT INTO OMS."userTopic" ("userId", "topics", "createdBy")
            VALUES ($1, $2, $3)
            ON CONFLICT ("userId")
            DO UPDATE SET
            "topics" = EXCLUDED."topics",
                "createdBy" = EXCLUDED."createdBy"  
            RETURNING *;
        `;


        const createUserTopic = await pool.query(upsertQuery, [
            currentUserId,
            topicIds,
            currentUserId,
        ]);

        const topicArr = createUserTopic?.rows?.length > 0 && createUserTopic?.rows[0]?.topics

        const query = `
        SELECT array_agg("name") AS topic_names
        FROM OMS."firebaseTopic" 
        WHERE "deletedAt" IS NULL 
          AND "active" = true 
          AND id = ANY($1::int[]);
    `;

        const result = await pool.query(query, [topicArr]);
        const topicNames = result?.rows?.length > 0 && result?.rows[0]?.topic_names;

        if (userData?.rows?.length > 0 && !userData?.rows[0]?.firebaseToken)
            throw new Error("Something went wrong Firebase Token is not found")

        if (topicNames?.length > 0 && userData?.rows?.length > 0 && userData?.rows[0]?.firebaseToken) {
            console.log('new Date() before subscribe :>> ', new Date());
            await firebaseSubscribeToMultipleTopics(userData?.rows?.length > 0 && userData?.rows[0]?.firebaseToken, topicNames)
            console.log('new Date() after subscribe :>> ', new Date());

        }

        sendSuccess(res, topicIds?.length == 0 ? "Topics Unsubscribed successfully" : "Topics subscribed successfully", topicNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};



export default { getAllNotificationsForUser, getNotificationDetailById, getFirebaseTopics, subscribeFirebaseTopics }