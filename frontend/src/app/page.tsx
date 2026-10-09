"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:8000/")
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch((error) => console.error("Backend error:", error));
  }, []);

  return (
    <main>
      <h1>AI Study Agent</h1>
      <p>{message}</p>
    </main>
  );
}