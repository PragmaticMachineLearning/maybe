import React, { useEffect } from "react";

import {
  documentationSections,
  quickStartSteps,
} from "../../docs/documentationContent";
import styles from "./DocumentationPanel.module.css";

interface DocumentationPanelProps {
  onClose: () => void;
}

export const DocumentationPanel: React.FC<DocumentationPanelProps> = ({
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maybe-docs-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Maybe docs</p>
            <h2 id="maybe-docs-title" className={styles.title}>
              Probabilistic spreadsheet basics
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close docs"
            title="Close docs"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <nav className={styles.nav} aria-label="Documentation sections">
            {documentationSections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>

          <div className={styles.content}>
            {documentationSections.map((section) => (
              <section
                id={section.id}
                key={section.id}
                className={styles.section}
              >
                <h3>{section.title}</h3>
                {section.blocks.map((block) => (
                  <p key={block}>{block}</p>
                ))}

                {section.id === "quick-start" && (
                  <div className={styles.quickStartGrid}>
                    {quickStartSteps.map((step) => (
                      <div key={step.cell} className={styles.quickStartRow}>
                        <span className={styles.cell}>{step.cell}</span>
                        <code>{step.formula}</code>
                        <span>{step.note}</span>
                        {step.result && (
                          <strong className={styles.result}>
                            {step.result}
                          </strong>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {section.formulas && (
                  <dl className={styles.formulaList}>
                    {section.formulas.map((formula) => (
                      <div key={formula.notation}>
                        <dt>
                          <code>{formula.notation}</code>
                        </dt>
                        <dd>{formula.description}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
