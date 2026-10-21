import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';
import { FiHelpCircle, FiCornerDownRight, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

const MAX_VISIBLE = 5;

const AnswerForm = ({ onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText('');
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2 mt-2 ml-6">
      <input
        type="text"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your answer…"
        maxLength={1000}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
      />
      <button type="submit" disabled={submitting || !text.trim()} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-60">
        Post
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-muted hover:text-ink px-1 py-1.5">
        Cancel
      </button>
    </form>
  );
};

const QnASection = ({ productId, questions, setQuestions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useSelector((state) => state.auth);
  const [newQuestion, setNewQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const visibleQuestions = useMemo(
    () => (showAll ? questions : questions.slice(0, MAX_VISIBLE)),
    [questions, showAll]
  );

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!requireAuth(token, navigate, location, 'Please login to ask a question')) return;
    if (!newQuestion.trim()) return;
    setAsking(true);
    try {
      const response = await api.askQuestion(Number(productId), newQuestion.trim());
      setQuestions([response.data, ...questions]);
      setNewQuestion('');
      toast.success('Your question has been posted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not post your question');
    } finally {
      setAsking(false);
    }
  };

  const handleAnswer = async (questionId, text) => {
    if (!requireAuth(token, navigate, location, 'Please login to answer')) return;
    try {
      const response = await api.answerQuestion(questionId, text);
      setQuestions(questions.map((q) => (q.id === questionId ? response.data : q)));
      toast.success('Your answer has been posted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not post your answer');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      await api.deleteQuestion(questionId);
      setQuestions(questions.filter((q) => q.id !== questionId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not delete this question');
    }
  };

  const handleDeleteAnswer = async (questionId, answerId) => {
    try {
      await api.deleteAnswer(answerId);
      setQuestions(
        questions.map((q) =>
          q.id === questionId ? { ...q, answers: q.answers.filter((a) => a.id !== answerId) } : q
        )
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not delete this answer');
    }
  };

  return (
    <div className="mt-16 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-extrabold text-ink mb-6 flex items-center gap-2">
        <FiHelpCircle className="text-brand" /> Questions &amp; Answers
      </h2>

      <form onSubmit={handleAsk} className="flex items-start gap-2 mb-8 max-w-xl">
        <input
          type="text"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Ask a question about this product…"
          maxLength={500}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
        />
        <button type="submit" disabled={asking || !newQuestion.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-60 whitespace-nowrap">
          {asking ? 'Posting…' : 'Ask'}
        </button>
      </form>

      {questions.length === 0 ? (
        <p className="text-muted text-sm">No questions yet - be the first to ask about this product.</p>
      ) : (
        <div className="space-y-5">
          {visibleQuestions.map((q) => (
            <div key={q.id} className="border border-gray-200 rounded p-4">
              <div className="flex justify-between items-start gap-2 mb-1">
                <p className="text-sm font-semibold text-ink">Q: {q.question}</p>
                {(user?.id === q.user_id || user?.is_admin) && (
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    aria-label="Delete question"
                    className="text-muted hover:text-brand shrink-0"
                  >
                    <FiTrash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted mb-3">Asked by {q.asker_name}</p>

              {q.answers.length > 0 && (
                <div className="space-y-2 mb-2">
                  {q.answers.map((a) => (
                    <div key={a.id} className="flex items-start gap-1.5 ml-1">
                      <FiCornerDownRight className="text-muted shrink-0 mt-0.5" size={14} />
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{a.answer}</p>
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          {a.is_seller_answer ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <FiCheckCircle size={11} /> Mahabaleshwar Hills Hub
                            </span>
                          ) : (
                            a.answerer_name
                          )}
                          {(user?.id === a.user_id || user?.is_admin) && (
                            <button
                              onClick={() => handleDeleteAnswer(q.id, a.id)}
                              aria-label="Delete answer"
                              className="text-muted hover:text-brand ml-1"
                            >
                              <FiTrash2 size={11} />
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === q.id ? (
                <AnswerForm
                  onSubmit={(text) => handleAnswer(q.id, text)}
                  onCancel={() => setReplyingTo(null)}
                />
              ) : (
                <button
                  onClick={() => setReplyingTo(q.id)}
                  className="text-xs font-semibold text-brand hover:underline ml-6"
                >
                  Answer this question
                </button>
              )}
            </div>
          ))}

          {questions.length > MAX_VISIBLE && !showAll && (
            <button onClick={() => setShowAll(true)} className="text-sm font-semibold text-brand hover:underline">
              View all {questions.length} questions
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QnASection;
