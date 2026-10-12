import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

const getSpeechRecognition = () => (
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition || null
);

export default function VoiceInputButton({ onTranscript, disabled = false }) {
  const { language, t } = useI18n();
  const [speechLanguage, setSpeechLanguage] = useState(language === 'ta' ? 'ta-IN' : 'en-IN');
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognitionRef = useRef(null);
  const SpeechRecognition = getSpeechRecognition();

  useEffect(() => {
    setSpeechLanguage(language === 'ta' ? 'ta-IN' : 'en-IN');
  }, [language]);

  useEffect(() => () => recognitionRef.current?.abort(), []);
  if (!SpeechRecognition) return null;

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const startListening = () => {
    if (disabled || listening) return;
    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) onTranscript(transcript);
      setMessage('');
      setListening(false);
    };
    recognition.onerror = (event) => {
      setMessage(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? t('Microphone access was denied. You can type instead.')
        : t('Voice input failed. Please type your message.'));
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setMessage(t('Listening… Speak now.'));
    setListening(true);
    recognition.start();
  };

  return (
    <div className="voice-input">
      <label className="voice-language">
        <span>{t('Voice input language')}</span>
        <select
          value={speechLanguage}
          disabled={disabled || listening}
          onChange={(event) => setSpeechLanguage(event.target.value)}
          aria-label={t('Voice input language')}
        >
          <option value="en-IN">English</option>
          <option value="ta-IN">தமிழ்</option>
        </select>
      </label>
      <button
        type="button"
        className={`btn btn-secondary btn-sm voice-button${listening ? ' voice-listening' : ''}`}
        disabled={disabled}
        aria-label={t(listening ? 'Stop voice input' : 'Start voice input')}
        onClick={listening ? stopListening : startListening}
      >
        {listening ? <MicOff size={17} /> : <Mic size={17} />}
        <span>{t(listening ? 'Stop voice input' : 'Start voice input')}</span>
      </button>
      {message && <span className="voice-status" role="status">{message}</span>}
    </div>
  );
}
