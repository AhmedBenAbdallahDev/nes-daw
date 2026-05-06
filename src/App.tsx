import React from 'react';
import { DAWProvider } from './context/DAWContext';
import { Editor } from './components/Editor';

export default function App() {
  return (
    <DAWProvider>
      <Editor />
    </DAWProvider>
  );
}

