import { useRef, useCallback } from "react";
import { Button, ButtonGroup, TextField, Text, LegacyStack } from "@shopify/polaris";

/**
 * RichTextField - A text field with formatting toolbar
 * Supports Bold, Italic, Underline, and Link formatting via HTML tags
 */
export function RichTextField({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  multiline = 3,
}) {
  const textareaRef = useRef(null);

  // Get the actual textarea element from Polaris TextField
  const getTextarea = useCallback(() => {
    if (textareaRef.current) {
      return textareaRef.current.querySelector('textarea');
    }
    return null;
  }, []);

  // Wrap selected text with HTML tags
  const wrapSelection = useCallback((openTag, closeTag) => {
    const textarea = getTextarea();
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let newValue;
    let newCursorPos;

    if (selectedText) {
      // Wrap selected text
      newValue = value.substring(0, start) + openTag + selectedText + closeTag + value.substring(end);
      newCursorPos = end + openTag.length + closeTag.length;
    } else {
      // Insert tags at cursor
      newValue = value.substring(0, start) + openTag + closeTag + value.substring(end);
      newCursorPos = start + openTag.length;
    }

    onChange(newValue);

    // Restore focus and cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange, getTextarea]);

  const handleBold = useCallback(() => {
    wrapSelection('<b>', '</b>');
  }, [wrapSelection]);

  const handleItalic = useCallback(() => {
    wrapSelection('<i>', '</i>');
  }, [wrapSelection]);

  const handleUnderline = useCallback(() => {
    wrapSelection('<u>', '</u>');
  }, [wrapSelection]);

  const handleLink = useCallback(() => {
    const textarea = getTextarea();
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    const url = prompt('Enter URL:', 'https://');
    if (!url) return;

    let newValue;
    let newCursorPos;

    if (selectedText) {
      // Wrap selected text as link
      newValue = value.substring(0, start) + `<a href="${url}">` + selectedText + '</a>' + value.substring(end);
      newCursorPos = end + `<a href="${url}">`.length + '</a>'.length;
    } else {
      // Insert link at cursor
      const linkText = prompt('Enter link text:', 'Click here') || 'Link';
      newValue = value.substring(0, start) + `<a href="${url}">${linkText}</a>` + value.substring(end);
      newCursorPos = start + `<a href="${url}">${linkText}</a>`.length;
    }

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange, getTextarea]);

  return (
    <LegacyStack vertical spacing="tight">
      {label && (
        <Text variant="bodyMd" as="label" fontWeight="medium">
          {label}
        </Text>
      )}

      <div
        style={{
          border: '1px solid #c4cdd5',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Formatting Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderBottom: '1px solid #e1e3e5',
            backgroundColor: '#f6f6f7',
          }}
        >
          <ButtonGroup segmented>
            <Button
              size="slim"
              onClick={handleBold}
              accessibilityLabel="Bold"
            >
              <span style={{ fontWeight: 'bold' }}>B</span>
            </Button>
            <Button
              size="slim"
              onClick={handleItalic}
              accessibilityLabel="Italic"
            >
              <span style={{ fontStyle: 'italic' }}>I</span>
            </Button>
            <Button
              size="slim"
              onClick={handleUnderline}
              accessibilityLabel="Underline"
            >
              <span style={{ textDecoration: 'underline' }}>U</span>
            </Button>
          </ButtonGroup>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#c4cdd5', margin: '0 4px' }} />

          <Button
            size="slim"
            onClick={handleLink}
            accessibilityLabel="Insert link"
          >
            🔗
          </Button>
        </div>

        {/* Text Area */}
        <div ref={textareaRef} style={{ margin: '-1px' }}>
          <TextField
            value={value}
            onChange={onChange}
            multiline={multiline}
            placeholder={placeholder}
            autoComplete="off"
            connectedTop
          />
        </div>
      </div>

      {helpText && (
        <Text variant="bodySm" as="p" tone="subdued">
          {helpText}
        </Text>
      )}
    </LegacyStack>
  );
}

export default RichTextField;
