"use client";
import PublicArrow from "@/components/PublicArrow";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Link from "next/link";

const steps = [
  {
    label: "A clear assignment",
    role: "Sam’s workspace",
    title: "Your next task, already in view.",
    copy: "A lead assigns the work. Sam gets a notification and opens the task with its deadline, remaining effort and owner attached.",
    tag: "TASK ASSIGNED",
    subject: "Test the release flow",
    detail: "Sam · 6h remaining · Due Friday",
    message: "Alex assigned you: Test the release flow",
    action: "Open assigned task",
    result:
      "The next step is visible. No need to search through a whole team board.",
  },
  {
    label: "A blocker with a next step",
    role: "Sam’s workspace",
    title: "Ask for a decision where the work lives.",
    copy: "Sam needs a staging account. A task-linked request explains the blocker, and the lead gets a notification.",
    tag: "HELP REQUEST",
    subject: "I need staging access",
    detail: "Linked to Test the release flow",
    message: "Sam requested: Help",
    action: "Open team request",
    result: "A request has context, an author and a place for the answer.",
  },
  {
    label: "An answer that reaches you",
    role: "Sam’s inbox",
    title: "Keep the response with the request.",
    copy: "Alex replies with the next step. Sam’s inbox links back to that exact request, even after it has been resolved.",
    tag: "LEAD REPLY",
    subject: "Access is ready. Start with checkout.",
    detail: "Alex · Resolved help request",
    message: "Alex replied to your help request: resolved",
    action: "Read the lead’s response",
    result:
      "Decisions stay attached to the work instead of getting lost in chat.",
  },
  {
    label: "A deliverable worth reviewing",
    role: "Alex’s inbox",
    title: "Submitted is a step. Accepted is the finish.",
    copy: "Sam submits the task. The lead and reviewers get notified, open the evidence and record their review.",
    tag: "READY FOR REVIEW",
    subject: "Test the release flow",
    detail: "Sam · In review · Evidence attached",
    message: "Sam submitted for review: Test the release flow",
    action: "Review the deliverable",
    result:
      "Accepted work contributes evidence, alongside reviews and collaboration.",
  },
];

export default function ProductWorkflow() {
  const [index, setIndex] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const step = steps[index];
  useEffect(() => {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !panel.current
    )
      return;
    const motion = gsap.fromTo(
      panel.current,
      { y: 7 },
      { y: 0, duration: 0.3, ease: "power2.out" },
    );
    return () => {
      motion.kill();
    };
  }, [index]);
  return (
    <section
      className="product-workflow"
      id="walkthrough"
      aria-labelledby="workflow-heading"
    >
      <header>
        <p className="public-kicker">A WORKDAY, WITHOUT THE CHASING</p>
        <h2 id="workflow-heading">
          From “who’s doing this?”
          <br />
          to “ready for review.”
        </h2>
        <p>
          Follow one task through the team. This interactive example uses
          fictional people and does not change a real project.
        </p>
      </header>
      <div className="workflow-stage">
        <div
          className="workflow-steps"
          role="tablist"
          aria-label="Explore the team workflow"
        >
          {steps.map((s, i) => (
            <button
              key={s.label}
              role="tab"
              id={`workflow-tab-${i}`}
              aria-controls="workflow-example"
              aria-selected={i === index}
              tabIndex={i === index ? 0 : -1}
              onKeyDown={(event) => {
                let next = i;
                if (["ArrowRight", "ArrowDown"].includes(event.key))
                  next = (i + 1) % steps.length;
                else if (["ArrowLeft", "ArrowUp"].includes(event.key))
                  next = (i + steps.length - 1) % steps.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = steps.length - 1;
                else return;
                event.preventDefault();
                setIndex(next);
                (
                  event.currentTarget.parentElement?.querySelectorAll("button")[
                    next
                  ] as HTMLButtonElement
                )?.focus();
              }}
              onClick={() => setIndex(i)}
            >
              <span>0{i + 1}</span>
              <strong>{s.label}</strong>
              <span aria-hidden="true">
                <PublicArrow />
              </span>
            </button>
          ))}
        </div>
        <div
          className="workflow-example"
          ref={panel}
          role="tabpanel"
          tabIndex={0}
          id="workflow-example"
          aria-labelledby={`workflow-tab-${index}`}
        >
          <div className="workflow-window">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <strong>{step.role}</strong>
            <small>Illustrative workspace</small>
          </div>
          <div className="workflow-notice">
            <span className="workflow-dot" />
            <div>
              <small>{step.tag}</small>
              <p>{step.message}</p>
            </div>
            <span>now</span>
          </div>
          <div className="workflow-task">
            <small>CG-24 / CAMPUS RELEASE</small>
            <h3>{step.subject}</h3>
            <p>{step.detail}</p>
            <div className="workflow-rule" />
            <p>{step.result}</p>
            <button onClick={() => setIndex((index + 1) % steps.length)}>
              {index === 3 ? "Replay the workflow" : "See the next step"}{" "}
              <span aria-hidden="true">
                <PublicArrow direction="right" />
              </span>
            </button>
          </div>
        </div>
      </div>
      <div className="workflow-caption">
        <div>
          <h3>{step.title}</h3>
          <p>{step.copy}</p>
        </div>
        <Link href="/app?signup=1" className="public-button">
          Try it with your team <PublicArrow />
        </Link>
      </div>
      <p className="workflow-boundary">
        Notifications stay in your in-app inbox and refresh every 15 seconds
        while you’re active. Email and device push are not included.
      </p>
    </section>
  );
}
