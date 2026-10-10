import React, {
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    FaPaperPlane,
    FaUserCircle,
    FaComments,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const MessagePanel = ({
    userId,
    projectId = null,
    otherUser,
}) => {
    const { user } = useContext(AuthContext);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const messagesEndRef = useRef(null);

    // ==========================================
    // CURRENT USER ID
    // ==========================================
    const currentUserId =
        user?._id || user?.id;

    // ==========================================
    // FETCH MESSAGES
    // ==========================================
    useEffect(() => {
        if (!userId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        fetchMessages();
    }, [userId, projectId]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();

            params.append("userId", userId);

            if (projectId) {
                params.append(
                    "projectId",
                    projectId
                );
            }

            const { data } = await api.get(
                `/messages?${params.toString()}`
            );

            setMessages(
                Array.isArray(data)
                    ? data
                    : data?.messages || []
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load messages."
            );

            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // SCROLL TO BOTTOM
    // ==========================================
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages]);

    // ==========================================
    // MARK CONVERSATION AS READ
    // ==========================================
    useEffect(() => {
        if (!userId) return;

        markConversationAsRead();
    }, [userId, projectId]);

    const markConversationAsRead = async () => {
        try {
            const payload = {
                userId,
            };

            if (projectId) {
                payload.projectId =
                    projectId;
            }

            await api.put(
                "/messages/conversation/read",
                payload
            );
        } catch (err) {
            console.error(
                "Mark conversation as read error:",
                err
            );
        }
    };

    // ==========================================
    // SEND MESSAGE
    // ==========================================
    const handleSend = async (e) => {
        e?.preventDefault();

        const trimmedMessage =
            message.trim();

        if (
            !trimmedMessage ||
            !userId ||
            sending
        ) {
            return;
        }

        try {
            setSending(true);
            setError("");

            const payload = {
                receiver: userId,
                message: trimmedMessage,
            };

            if (projectId) {
                payload.project =
                    projectId;
            }

            const { data } =
                await api.post(
                    "/messages",
                    payload
                );

            const newMessage =
                data?.data;

            if (newMessage) {
                setMessages(
                    (previous) => [
                        ...previous,
                        newMessage,
                    ]
                );
            }

            setMessage("");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to send message."
            );
        } finally {
            setSending(false);
        }
    };

    // ==========================================
    // ENTER TO SEND
    // ==========================================
    const handleKeyDown = (e) => {
        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {
            e.preventDefault();
            handleSend(e);
        }
    };

    // ==========================================
    // DATE FORMAT
    // ==========================================
    const formatDate = (date) => {
        if (!date) return "";

        const parsedDate = new Date(date);

        if (
            Number.isNaN(
                parsedDate.getTime()
            )
        ) {
            return "";
        }

        return parsedDate.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    };

    // ==========================================
    // NO CONVERSATION SELECTED
    // ==========================================
    if (!userId) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">

                <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                    <FaComments className="text-2xl" />
                </div>

                <h3 className="text-lg font-bold text-gray-900">
                    Select a conversation
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                    Choose a conversation to
                    start messaging.
                </p>

            </div>
        );
    }

    return (
        <div className="h-[600px] bg-white rounded-xl border border-gray-100 shadow-lg flex flex-col overflow-hidden">

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="bg-gray-900 text-white px-5 py-4 flex items-center gap-3 shrink-0">

                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <FaComments />
                </div>

                <div className="min-w-0">

                    <h2 className="font-bold truncate">
                        {otherUser?.name ||
                            "Conversation"}
                    </h2>

                    <p className="text-xs text-gray-300 capitalize">
                        {projectId
                            ? "Project conversation"
                            : otherUser?.role ||
                              "Conversation"}
                    </p>

                </div>

            </div>

            {/* ======================================
                MESSAGES
            ====================================== */}
            <div className="flex-1 overflow-y-auto bg-white p-5">

                {loading ? (
                    <div className="h-full flex items-center justify-center">

                        <div className="w-9 h-9 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

                    </div>
                ) : error &&
                  messages.length === 0 ? (

                    <div className="h-full flex items-center justify-center text-center">

                        <div>

                            <div className="w-14 h-14 mx-auto bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3">
                                <FaComments />
                            </div>

                            <p className="text-red-600 font-semibold">
                                {error}
                            </p>

                        </div>

                    </div>
                ) : messages.length ===
                  0 ? (

                    <div className="h-full flex flex-col items-center justify-center text-center">

                        <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                            <FaComments className="text-2xl" />
                        </div>

                        <h3 className="text-lg font-bold text-gray-900">
                            No messages yet
                        </h3>

                        <p className="text-sm text-gray-500 mt-1">
                            Start a conversation.
                        </p>

                    </div>
                ) : (

                    <div className="space-y-4">

                        {messages.map(
                            (item) => {
                                const senderId =
                                    item.sender?._id ||
                                    item.sender;

                                /*
                                 * IMPORTANT:
                                 * Compare the message sender
                                 * with the authenticated user.
                                 */
                                const isMine =
                                    senderId
                                        ?.toString() ===
                                    currentUserId
                                        ?.toString();

                                return (
                                    <div
                                        key={
                                            item._id
                                        }
                                        className={`flex w-full ${
                                            isMine
                                                ? "justify-end"
                                                : "justify-start"
                                        }`}
                                    >

                                        <div
                                            className={`max-w-[75%] flex flex-col ${
                                                isMine
                                                    ? "items-end"
                                                    : "items-start"
                                            }`}
                                        >

                                            <div
                                                className={`flex items-end gap-2 ${
                                                    isMine
                                                        ? "flex-row-reverse"
                                                        : "flex-row"
                                                }`}
                                            >

                                                {!isMine && (
                                                    <FaUserCircle className="text-gray-300 text-2xl shrink-0" />
                                                )}

                                                <div
                                                    className={`px-4 py-3 rounded-2xl break-words ${
                                                        isMine
                                                            ? "bg-gray-900 text-white rounded-br-md"
                                                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                                                    }`}
                                                >

                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                        {
                                                            item.message
                                                        }
                                                    </p>

                                                </div>

                                            </div>

                                            <span
                                                className={`text-[11px] text-gray-400 mt-1 ${
                                                    isMine
                                                        ? "mr-1"
                                                        : "ml-9"
                                                }`}
                                            >
                                                {formatDate(
                                                    item.createdAt
                                                )}
                                            </span>

                                        </div>

                                    </div>
                                );
                            }
                        )}

                        <div
                            ref={
                                messagesEndRef
                            }
                        />

                    </div>
                )}

            </div>

            {/* ======================================
                ERROR
            ====================================== */}
            {error &&
                messages.length > 0 && (
                    <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-red-600 text-sm">
                        {error}
                    </div>
                )}

            {/* ======================================
                INPUT
            ====================================== */}
            <form
                onSubmit={handleSend}
                className="border-t border-gray-100 bg-white p-4 shrink-0"
            >

                <div className="flex items-center gap-3">

                    <input
                        type="text"
                        value={message}
                        onChange={(e) =>
                            setMessage(
                                e.target.value
                            )
                        }
                        onKeyDown={
                            handleKeyDown
                        }
                        placeholder="Type a message..."
                        disabled={sending}
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition disabled:bg-gray-100"
                    />

                    <button
                        type="submit"
                        disabled={
                            sending ||
                            !message.trim()
                        }
                        className="w-11 h-11 shrink-0 bg-gray-900 text-white rounded-lg flex items-center justify-center hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FaPaperPlane />
                    </button>

                </div>

            </form>

        </div>
    );
};

export default MessagePanel;