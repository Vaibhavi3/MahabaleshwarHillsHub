import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axiosConfig';
import { requireAuth } from '../utils/requireAuth';
import { FiMessageCircle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const QuestionsSection = ({ productId, questions, setQuestions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useSelector((state) => state.auth);
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openAnswerFor, setOpenAnswerFor] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answering, setAnswering] = useState(false);

  const answeredCount = useMemo(
    () => questions.filter((q) => q.answers.length > 0).length,
    [questions]
  );

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!requireAuth(token, navigate, location, 'Please login to ask a question')) return;
    if (questionText.trim().length < 3) {
      toast.error('Please enter a question');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.askProductQuestion(Number(productId), questionText.trim());
      setQuestions([response.data, ...questions]);
      setQuestionText('');
      toast.success("Thanks! We'll let you know when it's answered.");
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not post your question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = async (questionId) => {
    if (!requireAuth(token, navigate, location, 'Please login to answer this question')) return;
    if (answerText.trim().length < 1) {
      toast.error('Please enter an answer');
      return;
    }
    setAnswering(true);
    try {
      const response = await api.answerProductQuestion(questionId, answerText.trim());
      setQuestions(
        questions.map((q) =>
          q.id === questionId ? { ...q, answers: [...q.answers, response.data] } : q
        )
      );
      setAnswerText('');
      setOpenAnswerFor(null);
      toast.success('Answer posted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not post your answer');
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className="mt-16 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-extrabold text-ink mb-1">Customer Questions &amp; Answers</h2>
      <p className="text-sm text-muted mb-6">
        {questions.length > 0
          ? `${questions.length} question${questions.length !== 1 ? 's' : ''} · ${answeredCount} answered`
          : 'Have a question about fit, material, or care? Ask shoppers and the Mahabaleshwar Hills Hub team.'}
      </p>

      <form onSubmit={handleAsk} className="border border-gray-200 rounded p-4 mb-8 max-w-xl">
        <p className="text-sm font-bold text-ink uppercase mb-3">Ask a Question</p>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="e.g. Is this true to size? Is it machine washable?"
          rows={2}
          maxLength={500}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full mb-3"
        />
        <button type="submit" disabled={submitting} className="btn-primary px-6 py-2 text-sm disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post Question'}
        </button>
      </form>

      {questions.length > 0 ? (
        <div className="space-y-5">
          {questions.map((q) => (
            <div key={q.id} className="border border-gray-200 rounded p-4">
              <div className="flex items-start gap-2 mb-1">
                <FiMessageCircle className="text-brand mt-0.5 shrink-0" size={16} />
                <p className="text-sm font-semibold text-ink">{q.question}</p>
              </div>
              <p className="text-xs text-muted mb-3 ml-6">Asked by {q.asker_name}</p>

              {q.answers.length > 0 && (
                <div className="ml-6 space-y-3 mb-3">
                  {q.answers.map((a) => (
                    <div key={a.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            a.is_seller ? 'bg-brand text-white' : 'bg-surface text-ink'
                          }`}
                        >
                          {a.is_seller ? 'Seller Answer' : a.responder_name}
                        </span>
                        {a.verified_purchase && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <FiCheckCircle size={12} /> Verified Buyer
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{a.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {openAnswerFor === q.id ? (
                <div className="ml-6">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Write your answer…"
                    rows={2}
                    maxLength={1000}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full mb-2 max-w-md"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAnswer(q.id)}
                      disabled={answering}
                      className="btn-primary px-4 py-1.5 text-xs disabled:opacity-60"
                    >
                      {answering ? 'Posting…' : 'Submit Answer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenAnswerFor(null);
                        setAnswerText('');
                      }}
                      className="btn-secondary px-4 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenAnswerFor(q.id)}
                  className="ml-6 text-xs font-semibold text-brand hover:underline"
                >
                  Answer this question
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm">No questions yet - be the first to ask.</p>
      )}
    </div>
  );
};

export default QuestionsSection;
