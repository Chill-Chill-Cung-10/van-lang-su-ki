"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const prologueSlides = [
  {
    id: "dawn",
    image: "/story/01-dawn-of-van-lang.png",
    chapter: "Khởi nguyên",
    speaker: "Lời của núi sông",
    text: "Thuở đất trời còn phủ sương trên những triền núi phương Nam, cư dân Lạc Việt đã tụ về bên sông lớn. Họ dựng nhà, gieo mạ và cùng nhau gìn giữ miền đất sẽ được gọi tên là Văn Lang.",
  },
  {
    id: "ceremony",
    image: "/story/02-bronze-drum-ceremony.png",
    chapter: "Tiếng gọi cộng đồng",
    speaker: "Sử quan Tuyên",
    text: "Giữa đại lễ, tiếng trống đồng Đông Sơn vang qua thung lũng. Mỗi nhịp trống là một lời hiệu triệu: các bộ lạc cùng chung sức, tôn Hùng Vương đứng đầu và gây dựng nền móng của nhà nước sơ khai.",
  },
  {
    id: "omens",
    image: "/story/03-ominous-signs.png",
    chapter: "Điềm dữ phương xa",
    speaker: "Huyền Quan Canh Thời",
    text: "Nhưng ngoài chân trời, lửa hiệu đã cháy. Gió mang theo mùi khói và tiếng binh khí lạ. Những mảnh ký ức của Văn Lang bắt đầu rạn vỡ, chìm dần vào màn sương của thời gian.",
  },
  {
    id: "journey",
    image: "/story/04-hero-begins-journey.png",
    chapter: "Hành trình bắt đầu",
    speaker: "Lời thề của người giữ sử",
    text: "Ngươi được chọn để bước qua cánh cổng ký ức. Hãy tìm lại những bí kíp thất truyền, lắng nghe người xưa và chứng minh rằng lịch sử không chỉ để nhớ—mà còn để tiếp nối.",
  },
] as const;

function TypewriterText({ text, onComplete }: { text: string; onComplete: () => void }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const timer = window.setTimeout(() => {
        setVisibleLength(text.length);
        onComplete();
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let nextLength = 0;
    const timer = window.setInterval(() => {
      nextLength += 1;
      setVisibleLength(nextLength);
      if (nextLength >= text.length) {
        window.clearInterval(timer);
        onComplete();
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [onComplete, text]);

  return (
    <>
      <span aria-hidden="true">{text.slice(0, visibleLength)}<span className="type-caret" /></span>
      <span className="story-sr-only">{text}</span>
    </>
  );
}

export function VanlangPrologue({ onComplete }: { onComplete: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const slide = prologueSlides[slideIndex];
  const isLastSlide = slideIndex === prologueSlides.length - 1;
  const markTypingDone = useCallback(() => setTypingDone(true), []);

  const advance = () => {
    if (!typingDone) return;
    if (isLastSlide) {
      onComplete();
      return;
    }
    setTypingDone(false);
    setSlideIndex((current) => current + 1);
  };

  return (
    <main id="noi-dung-chinh" className="prologue-screen" aria-label="Cốt truyện mở đầu Văn Lang Sử Ký">
      <div className="prologue-background" aria-hidden="true">
        <Image key={slide.image} src={slide.image} alt="" fill priority sizes="100vw" />
      </div>
      <div className="prologue-shade" aria-hidden="true" />

      <section className="story-dialogue" aria-labelledby="story-speaker">
        <div className="story-ornament" aria-hidden="true"><span /><i /><span /></div>
        <div className="story-copy">
          <p className="story-chapter">{slide.chapter}</p>
          <h1 id="story-speaker">{slide.speaker}</h1>
          <p className="story-text" key={slide.id}>
            <TypewriterText text={slide.text} onComplete={markTypingDone} />
          </p>
        </div>
        {typingDone ? (
          <button className="story-next" type="button" onClick={advance}>
            {isLastSlide ? "Đã hiểu" : "Tiếp theo"}
            <span aria-hidden="true">{isLastSlide ? "◆" : "›"}</span>
          </button>
        ) : null}
      </section>
    </main>
  );
}
