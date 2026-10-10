import React, { useContext, useEffect, useState } from "react";
import {
  FaComments,
  FaUserCircle,
  FaSearch,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";
import MessagePanel from "../components/MessagePanel";

const Messages = () => {
  const { user } = useContext(AuthContext);

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // ==========================================
  // GET CONVERSATIONS
  // ==========================================
  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get(
        "/messages/conversations"
      );

      setConversations(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load conversations."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // INITIAL LOAD
  // ==========================================
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // ==========================================
  // FILTER CONVERSATIONS
  // ==========================================
  const filteredConversations =
    conversations.filter((conversation) => {
      const otherUser = conversation.otherUser;

      const name =
        otherUser?.name?.toLowerCase() || "";

      const email =
        otherUser?.email?.toLowerCase() || "";

      const projectName =
        conversation.project?.name?.toLowerCase() ||
        "";

      const searchText =
        search.toLowerCase();

      return (
        name.includes(searchText) ||
        email.includes(searchText) ||
        projectName.includes(searchText)
      );
    });

  // ==========================================
  // SELECT CONVERSATION
  // ==========================================
  const handleSelectConversation = (
    conversation
  ) => {
    setSelectedConversation(conversation);
  };

  // ==========================================
  // GET DISPLAY NAME
  // ==========================================
  const getUserName = (conversation) => {
    return (
      conversation.otherUser?.name ||
      "Unknown User"
    );
  };

  // ==========================================
  // GET ROLE
  // ==========================================
  const getUserRole = (conversation) => {
    const role =
      conversation.otherUser?.role;

    if (!role) return "";

    return (
      role.charAt(0).toUpperCase() +
      role.slice(1)
    );
  };

  // ==========================================
  // FORMAT DATE
  // ==========================================
  const formatTime = (date) => {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
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
  // NO USER
  // ==========================================
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">
          Please login to access messages.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* ======================================
          HEADER
      ====================================== */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center text-xl">
            <FaComments />
          </div>

          <div>
            <p className="text-gray-400 text-sm font-semibold mb-1">
              COMMUNICATION
            </p>

            <h1 className="text-2xl sm:text-3xl font-extrabold">
              Messages
            </h1>

            <p className="text-gray-300 text-sm mt-1">
              Communicate with your project team.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================
          ERROR
      ====================================== */}
      {error && (
        <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-4 mb-5">
          {error}
        </div>
      )}

      {/* ======================================
          CHAT LAYOUT
      ====================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* ====================================
            CONVERSATION LIST
        ==================================== */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden h-[600px] flex flex-col">
          {/* LIST HEADER */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 mb-3">
              Conversations
            </h2>

            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-700"
              />
            </div>
          </div>

          {/* CONVERSATIONS */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="inline-block w-7 h-7 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

                <p className="text-sm text-gray-500 mt-3">
                  Loading conversations...
                </p>
              </div>
            ) : filteredConversations.length ===
              0 ? (
              <div className="p-6 text-center">
                <FaComments className="mx-auto text-3xl text-gray-300 mb-3" />

                <p className="text-sm text-gray-500">
                  No conversations found.
                </p>
              </div>
            ) : (
              filteredConversations.map(
                (conversation) => {
                  const otherUser =
                    conversation.otherUser;

                  const isSelected =
                    selectedConversation
                      ?.conversationId ===
                    conversation.conversationId;

                  return (
                    <button
                      key={
                        conversation.conversationId
                      }
                      type="button"
                      onClick={() =>
                        handleSelectConversation(
                          conversation
                        )
                      }
                      className={`w-full text-left p-4 border-b border-gray-100 transition ${
                        isSelected
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex gap-3">
                        <FaUserCircle className="text-3xl text-gray-400 shrink-0" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {getUserName(
                                conversation
                              )}
                            </h3>

                            {conversation.unreadCount >
                              0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center">
                                {
                                  conversation.unreadCount
                                }
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-500">
                            {getUserRole(
                              conversation
                            )}
                          </p>

                          {conversation.project && (
                            <p className="text-xs text-gray-700 font-medium mt-1 truncate">
                              Project:{" "}
                              {
                                conversation.project
                                  .name
                              }
                            </p>
                          )}

                          <p className="text-xs text-gray-400 truncate mt-1">
                            {conversation.lastMessage ||
                              "No messages"}
                          </p>

                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatTime(
                              conversation.lastMessageAt
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>

        {/* ====================================
            MESSAGE PANEL
        ==================================== */}
        <div>
          {selectedConversation ? (
            <MessagePanel
              userId={
                selectedConversation.otherUser?._id
              }
              projectId={
                selectedConversation.project?._id ||
                null
              }
              title={getUserName(
                selectedConversation
              )}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-lg h-[600px] flex items-center justify-center">
              <div className="text-center">
                <FaComments className="mx-auto text-5xl text-gray-300 mb-4" />

                <h2 className="font-bold text-gray-900 text-lg">
                  Select a conversation
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Choose a conversation to start
                  messaging.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;