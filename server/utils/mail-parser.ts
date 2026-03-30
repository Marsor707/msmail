import { simpleParser } from 'mailparser'
import type {
  FetchMessageObject,
  MessageAddressObject,
  MessageEnvelopeObject,
  MessageStructureObject,
} from 'imapflow'
import type { MailDetail, MailSummary } from '~/shared/types'

export async function toImapMailDetail(message: FetchMessageObject): Promise<MailDetail> {
  if (!message.source) {
    throw new Error('IMAP 邮件详情缺少原始报文')
  }

  const parsed = await simpleParser(message.source)
  const htmlBody = typeof parsed.html === 'string' ? parsed.html : ''
  const textBody = parsed.text?.trim() || ''
  const bodyType = htmlBody ? 'html' : 'text'
  const body = htmlBody || textBody
  const previewSource = textBody || stripHtml(body)

  return {
    id: String(message.uid),
    subject: parsed.subject?.trim() || message.envelope?.subject?.trim() || '(无主题)',
    fromName: parsed.from?.value?.[0]?.name?.trim() || firstAddressName(message.envelope) || '未知发件人',
    fromAddress: parsed.from?.value?.[0]?.address?.trim() || firstAddressEmail(message.envelope) || '-',
    toRecipients: normalizeRecipientList(parsed.to?.value, message.envelope?.to),
    ccRecipients: normalizeRecipientList(parsed.cc?.value, message.envelope?.cc),
    receivedAt: normalizeDate(parsed.date, message.internalDate, message.envelope?.date),
    isRead: hasSeenFlag(message.flags),
    hasAttachments: (parsed.attachments?.length ?? 0) > 0 || hasAttachments(message.bodyStructure),
    internetMessageId: parsed.messageId?.trim() || message.envelope?.messageId?.trim() || '-',
    bodyType,
    body,
    preview: previewSource.slice(0, 200).trim(),
  }
}

export function toImapMailSummary(message: FetchMessageObject): MailSummary {
  return {
    id: String(message.uid),
    subject: message.envelope?.subject?.trim() || '(无主题)',
    fromName: firstAddressName(message.envelope) || '未知发件人',
    fromAddress: firstAddressEmail(message.envelope) || '-',
    receivedAt: normalizeDate(undefined, message.internalDate, message.envelope?.date),
    hasAttachments: hasAttachments(message.bodyStructure),
    isRead: hasSeenFlag(message.flags),
  }
}

export function hasSeenFlag(flags?: Set<string>) {
  return Boolean(flags?.has('\\Seen'))
}

function hasAttachments(node?: MessageStructureObject): boolean {
  if (!node) {
    return false
  }

  const disposition = node.disposition?.toLowerCase() || ''
  const fileName = node.dispositionParameters?.filename || node.parameters?.name

  if (disposition === 'attachment' || Boolean(fileName)) {
    return true
  }

  return (node.childNodes ?? []).some((child) => hasAttachments(child))
}

function firstAddressName(envelope?: MessageEnvelopeObject) {
  return envelope?.from?.[0]?.name?.trim() || ''
}

function firstAddressEmail(envelope?: MessageEnvelopeObject) {
  return envelope?.from?.[0]?.address?.trim() || ''
}

function normalizeRecipientList(
  parsed:
    | Array<{
      name?: string
      address?: string
    }>
    | undefined,
  envelope: MessageAddressObject[] | undefined,
) {
  if (parsed?.length) {
    return parsed
      .map((item) => item.address?.trim())
      .filter((item): item is string => Boolean(item))
  }

  return (envelope ?? [])
    .map((item) => item.address?.trim())
    .filter((item): item is string => Boolean(item))
}

function normalizeDate(
  parsedDate?: Date | null,
  internalDate?: Date | string,
  envelopeDate?: Date,
) {
  const value = parsedDate ?? envelopeDate ?? internalDate

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    const nextDate = new Date(value)
    return Number.isNaN(nextDate.getTime()) ? value : nextDate.toISOString()
  }

  return ''
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
