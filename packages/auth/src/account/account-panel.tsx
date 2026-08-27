'use client'

/**
 * The account settings panel, mounted by both apps.
 *
 * Extracted from the calendar's 955-line user-profile-button, which was both the
 * avatar dropdown and this panel. The dropdown stays in the calendar — it belongs
 * to that app's chrome — while everything that manages an account lives here so
 * meet offers the identical surface rather than a second implementation that
 * drifts (ADR 0022).
 *
 * Everything app-specific arrives through AccountProvider. The important one is
 * `deleteAccount`: the calendar's endpoint removes calendar_events, settings,
 * categories, countdowns and bookmarks, and meet's has none of those, so a
 * literal '/api/account' in shared code would silently delete the wrong amount.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import {
  LogOut,
  Trash2,
  Mail,
  Upload,
  ChevronDown,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@zntr/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zntr/ui/alert-dialog'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { toast } from 'sonner'
import QRCodeStyling from 'qr-code-styling'
import { cn } from '@zntr/utils'
import { useAccount } from './context'

export type AccountSection = 'profile' | 'delete' | 'signout'

type AccountPanelProps = {
  /** Scrolls this row into view on mount, for a deep link from elsewhere. */
  focusSection?: AccountSection | null
}

export function AccountPanel({ focusSection = null }: AccountPanelProps) {
  const {
    copy: t,
    user,
    isLoading,
    client: authClient,
    refetchSession,
    navigate,
    deleteAccount: deleteAccountOnHost,
    signInHref,
  } = useAccount()
  const isAnySignedIn = Boolean(user)
  // Distinguished from signed-out deliberately: the session read returns no user
  // while it is in flight, and treating that as "signed out" is what showed a
  // signed-in user the Sign in and Sign up buttons for a beat.
  const isResolving = !user && isLoading === true

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  // Which security row is expanded. One at a time: each row hosts a stepped
  // flow (OTP, QR) and two open flows compete for attention and vertical room.
  const [profileSection, setProfileSection] = useState<
    'emails' | 'twofa' | 'password' | null
  >(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [changePasswordValue, setChangePasswordValue] = useState('')
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1)
  const [passwordOtp, setPasswordOtp] = useState('')
  const [emailStep, setEmailStep] = useState<1 | 2>(1)
  const [twoFaStep, setTwoFaStep] = useState<1 | 2 | 3>(1)
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [twoFactorPassword, setTwoFactorPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorPending, setTwoFactorPending] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorUri, setTwoFactorUri] = useState('')
  const [twoFactorQrCode, setTwoFactorQrCode] = useState('')
  const [passwordTurnstileToken, setPasswordTurnstileToken] = useState('')
  const [passwordCaptchaVersion, setPasswordCaptchaVersion] = useState(0)
  const twoFactorQrCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!focusSection) return
    const target = document.getElementById(`settings-account-${focusSection}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusSection])

  useEffect(() => {
    if (!deleteAccountOpen) {
      setDeleteAccountConfirmText('')
    }
  }, [deleteAccountOpen])

  useEffect(() => {
    setTwoFactorEnabled(Boolean(user?.twoFactorEnabled))
  }, [user?.twoFactorEnabled])

  useEffect(() => {
    if (!user) return
    const fullName = (user.name || '').trim()
    const parts = fullName ? fullName.split(/\s+/) : []
    setFirstName(parts[0] || '')
    setLastName(parts.slice(1).join(' '))
  }, [user])

  useEffect(() => {
    return () => {
      if (twoFactorQrCodeRef.current) {
        URL.revokeObjectURL(twoFactorQrCodeRef.current)
      }
    }
  }, [])

  async function saveProfile() {
    if (!user) return
    try {
      setProfileSaving(true)
      const name = `${firstName} ${lastName}`.trim()
      const { error } = await authClient.updateUser({ name: name || undefined })
      if (error) throw new Error(error.message || 'Failed to update profile')
      toast(t.profileUpdated)
    } catch (e: any) {
      toast(t.profileUpdateFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  async function updateAvatar(file?: File | null) {
    if (!user || !file) return
    try {
      setAvatarUploading(true)
      const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
      const MAX_SOURCE_BYTES = 20 * 1024 * 1024
      const MAX_DIMENSION = 512
      const INITIAL_QUALITY = 0.92
      const MIN_QUALITY = 0.5
      const QUALITY_STEP = 0.08
      if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('Image is too large. Please choose a smaller file.')
      }
      const image = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        const reader = new FileReader()
        reader.onload = () => {
          img.src = String(reader.result || '')
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        img.onload = () => {
          const side = Math.min(img.width, img.height)
          const sx = Math.floor((img.width - side) / 2)
          const sy = Math.floor((img.height - side) / 2)
          const target = Math.min(side, MAX_DIMENSION)
          const canvas = document.createElement('canvas')
          canvas.width = target
          canvas.height = target
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Failed to process image'))
          ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target)
          let quality = INITIAL_QUALITY
          let data = canvas.toDataURL('image/jpeg', quality)
          const getDataBytes = (base64DataUrl: string) => {
            const payload = base64DataUrl.split(',')[1] || ''
            return atob(payload).length
          }
          while (
            getDataBytes(data) > MAX_OUTPUT_BYTES &&
            quality > MIN_QUALITY
          ) {
            quality -= QUALITY_STEP
            data = canvas.toDataURL('image/jpeg', quality)
          }
          if (getDataBytes(data) > MAX_OUTPUT_BYTES) {
            return reject(
              new Error(
                'Image is too large after processing. Please choose a smaller file.',
              ),
            )
          }
          resolve(data)
        }
        img.onerror = () => reject(new Error('Unsupported image format'))
        reader.readAsDataURL(file)
      })
      const { error } = await authClient.updateUser({ image })
      if (error) throw new Error(error.message || 'Failed to update avatar')
      toast(t.avatarUpdated)
    } catch (e: any) {
      toast(t.avatarUpdateFailed, {
        description: e?.errors?.[0]?.longMessage || e?.message || '',
      })
    } finally {
      setAvatarUploading(false)
    }
  }

  async function sendEmailChangeOtp() {
    if (!newEmail) return
    setTwoFactorPending(true)
    const nextEmail = newEmail.trim().toLowerCase()
    const emailOtp = authClient.emailOtp
    if (!emailOtp) {
      toast(t.updateEmailFailed)
      return
    }
    const res = await emailOtp.requestEmailChange({
      newEmail: nextEmail,
    } as any)
    if (res.error) {
      toast(res.error.message || t.sendVerificationCodeFailed)
      setTwoFactorPending(false)
      return
    }
    setPendingEmail(nextEmail)
    setEmailStep(2)
    setTwoFactorPending(false)
    toast(t.verificationCodeSentNewEmail)
  }

  async function confirmEmailChange() {
    if (!pendingEmail || !emailOtp) return
    setTwoFactorPending(true)
    const emailOtpClient = authClient.emailOtp
    if (!emailOtpClient) {
      toast(t.updateEmailFailed)
      return
    }
    const res = await emailOtpClient.changeEmail({
      newEmail: pendingEmail,
      otp: emailOtp,
    } as any)
    if (res.error) {
      toast(res.error.message || t.updateEmailFailed)
      setTwoFactorPending(false)
      return
    }
    setNewEmail('')
    setPendingEmail('')
    setEmailOtp('')
    toast(t.emailUpdatedSuccessfully)
    await refetchSession()
    setEmailStep(1)
    setTwoFactorPending(false)
  }

  async function sendPasswordResetOtp() {
    if (!user?.email) return
    const requestPasswordReset = authClient.emailOtp?.requestPasswordReset
    if (!requestPasswordReset) {
      toast(t.sendVerificationCodeFailed)
      return
    }
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !passwordTurnstileToken) {
      toast('Please complete the CAPTCHA verification.')
      return
    }
    setTwoFactorPending(true)
    const res = await requestPasswordReset({
      email: user.email,
      ...(passwordTurnstileToken
        ? { turnstileToken: passwordTurnstileToken }
        : {}),
    })
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      setPasswordTurnstileToken('')
      setPasswordCaptchaVersion((value) => value + 1)
    }
    if (res.error) {
      toast(res.error.message || t.sendVerificationCodeFailed)
      setTwoFactorPending(false)
      return
    }
    setPasswordStep(2)
    setTwoFactorPending(false)
    toast(t.verificationCodeSentEmail)
  }

  async function confirmPasswordReset() {
    if (!user?.email || !passwordOtp || !changePasswordValue) return
    setTwoFactorPending(true)
    const res = await (authClient as any).emailOtp.resetPassword({
      email: user.email,
      otp: passwordOtp,
      password: changePasswordValue,
    })
    if (res.error) {
      toast(res.error.message || t.resetPasswordFailed)
      setTwoFactorPending(false)
      return
    }
    setChangePasswordValue('')
    setPasswordOtp('')
    setPasswordStep(1)
    setTwoFactorPending(false)
    toast(t.passwordUpdatedSuccessfully)
  }

  function resetTwoFactorFlow() {
    setTwoFaStep(1)
    setTwoFactorCode('')
    setTwoFactorPassword('')
    if (twoFactorQrCodeRef.current) {
      URL.revokeObjectURL(twoFactorQrCodeRef.current)
      twoFactorQrCodeRef.current = null
    }
    setTwoFactorQrCode('')
    setTwoFactorUri('')
  }

  async function enableTwoFactor() {
    if (!twoFactorPassword) return
    setTwoFactorPending(true)
    const twoFactor = authClient.twoFactor
    if (!twoFactor) {
      toast(t.enable2faFailed)
      return
    }
    const setupRes = await twoFactor.enable({
      password: twoFactorPassword,
    })
    if (setupRes.error) {
      toast(setupRes.error.message || t.enable2faFailed)
      setTwoFactorPending(false)
      return
    }
    const totpUri =
      (setupRes as any).data?.totpURI || (setupRes as any).data?.totpUri || ''
    setTwoFactorUri(totpUri)
    if (totpUri) {
      const qrCode = new QRCodeStyling({
        width: 220,
        height: 220,
        type: 'canvas',
        data: totpUri,
        margin: 2,
      })
      const qrBlob = await qrCode.getRawData('png')
      if (qrBlob instanceof Blob) {
        if (twoFactorQrCodeRef.current) {
          URL.revokeObjectURL(twoFactorQrCodeRef.current)
        }
        const qrUrl = URL.createObjectURL(qrBlob)
        twoFactorQrCodeRef.current = qrUrl
        setTwoFactorQrCode(qrUrl)
      }
    }
    setTwoFactorEnabled(true)
    setTwoFaStep(2)
    setTwoFactorPending(false)
    toast(t.twoFactorAuthentication)
  }

  async function disableTwoFactor() {
    if (!twoFactorPassword) return
    setTwoFactorPending(true)
    const twoFactorClient = authClient.twoFactor
    if (!twoFactorClient) {
      toast(t.disable2faFailed)
      return
    }
    const disableRes = await twoFactorClient.disable({
      password: twoFactorPassword,
    })
    if (disableRes.error) {
      toast(disableRes.error.message || t.disable2faFailed)
      setTwoFactorPending(false)
      return
    }
    setTwoFactorEnabled(false)
    resetTwoFactorFlow()
    setTwoFactorPending(false)
    toast(t.twoFactorAuthentication)
  }

  async function verifyTwoFactorSetup() {
    if (twoFactorCode.length < 6) return
    setTwoFactorPending(true)
    const twoFactorVerify = authClient.twoFactor
    if (!twoFactorVerify) {
      toast(t.enable2faFailed)
      return
    }
    const verifyRes = await twoFactorVerify.verifyTotp({
      code: twoFactorCode,
      trustDevice: true,
    })
    if (verifyRes.error) {
      toast(
        verifyRes.error.message ||
          t.invalidOtpCode.replace('{code}', t.otpCode),
      )
      setTwoFactorPending(false)
      return
    }
    toast(t.twoFactorSetupVerified)
    setTwoFactorCode('')
    setTwoFaStep(3)
    setTwoFactorPending(false)
  }

  async function deleteAccount() {
    if (!user || deleteAccountConfirmText !== 'DELETE MY ACCOUNT') return
    try {
      setIsDeletingAccount(true)
      const result = await deleteAccountOnHost()
      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete account data')
      }

      await authClient.signOut()

      toast(t.accountDeleted)
      // To sign-in rather than '/': the account no longer exists, so the app
      // root would only bounce back here through the auth guard.
      navigate(signInHref)
    } catch (e: any) {
      toast(t.deleteAccountFailed, {
        description: e?.message || '',
      })
    } finally {
      setIsDeletingAccount(false)
      setDeleteAccountOpen(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        {isResolving ? (
          <div data-account-loading className="space-y-6" aria-busy="true">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="h-9 animate-pulse rounded-md bg-muted" />
                  <div className="h-9 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              <div className="h-14 animate-pulse bg-muted/40" />
              <div className="h-14 animate-pulse bg-muted/40" />
              <div className="h-14 animate-pulse bg-muted/40" />
            </div>
          </div>
        ) : isAnySignedIn ? (
          <>
            {/* Identity: the avatar IS the upload control and the name is
                  edited in place — no separate "basic info" tab to find. */}
            <section
              id="settings-account-profile"
              className="space-y-4"
              aria-label={t.basicInfo}
            >
              <div className="flex items-start gap-4">
                <Label
                  htmlFor="profile-avatar-input"
                  className={cn(
                    'group relative shrink-0 cursor-pointer rounded-full',
                    avatarUploading && 'pointer-events-none opacity-60',
                  )}
                  aria-label={t.changeAvatar}
                >
                  <img
                    src={user?.image || '/user.png'}
                    alt="avatar"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full border object-cover"
                    referrerPolicy="no-referrer"
                    fetchPriority="high"
                  />
                  {/* Hover is an enhancement, not the affordance: Tailwind
                        v4 gates hover: behind (hover:hover), so on touch
                        devices this overlay can never appear. The corner
                        badge below is the always-visible entry point. */}
                  <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-full bg-gray-500/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
                    <Upload className="h-5 w-5 text-white" />
                  </span>
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </Label>
                <Input
                  id="profile-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={(e) => {
                    void updateAvatar(e.target.files?.[0])
                    e.currentTarget.value = ''
                  }}
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-first-name">{t.firstName}</Label>
                      <Input
                        id="profile-first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-last-name">{t.lastName}</Label>
                      <Input
                        id="profile-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-muted-foreground">
                      {user?.email || ''}
                    </p>
                    <Button
                      size="sm"
                      onClick={saveProfile}
                      disabled={profileSaving}
                    >
                      {profileSaving ? t.saving : t.saveProfile}
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Security: one expandable row per flow. Rows replace the old
                  Tabs, which overflowed horizontally and hid three of the
                  four sections behind unlabelled truncation. */}
            {isAnySignedIn ? (
              <section
                className="space-y-2"
                aria-label={t.twoFactorAuthentication}
              >
                <div className="divide-y rounded-lg border">
                  {(
                    [
                      // Email management needs the OTP plugin to verify the new
                      // address, and 2FA is a plugin outright. A row whose flow
                      // cannot complete is worse than an absent one: the user
                      // opens it, follows it, and gets an error at the end.
                      ...(authClient.emailOtp
                        ? [
                            {
                              key: 'emails' as const,
                              icon: <Mail className="h-4 w-4" />,
                              title: t.accountEmailManagement,
                              summary: user?.email || '-',
                            },
                          ]
                        : []),
                      ...(authClient.twoFactor
                        ? [
                            {
                              key: 'twofa' as const,
                              icon: <ShieldCheck className="h-4 w-4" />,
                              title: t.twoFactorAuthentication,
                              summary: twoFactorEnabled
                                ? t.twoFactorEnabledMessage
                                : t.twoFactorAuthenticationDescription,
                            },
                          ]
                        : []),
                      ...(authClient.emailOtp?.requestPasswordReset &&
                      authClient.emailOtp.resetPassword
                        ? [
                            {
                              key: 'password' as const,
                              icon: <KeyRound className="h-4 w-4" />,
                              title: t.changePassword,
                              summary: t.changePasswordDescription,
                            },
                          ]
                        : []),
                    ] as const
                  ).map((row) => {
                    const isOpen = profileSection === row.key
                    return (
                      <div key={row.key}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setProfileSection(isOpen ? null : row.key)
                          }
                        >
                          <span className="text-muted-foreground">
                            {row.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {row.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.summary}
                            </span>
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                              isOpen && 'rotate-180',
                            )}
                          />
                        </button>

                        {isOpen && row.key === 'emails' ? (
                          <div className="space-y-3 border-t bg-muted/30 px-4 py-4">
                            {emailStep === 1 ? (
                              <>
                                <div className="space-y-1.5">
                                  <Label htmlFor="account-new-email">
                                    {t.newEmail}
                                  </Label>
                                  <Input
                                    id="account-new-email"
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) =>
                                      setNewEmail(e.target.value)
                                    }
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  onClick={sendEmailChangeOtp}
                                  disabled={twoFactorPending || !newEmail}
                                >
                                  {t.next}
                                </Button>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  {t.verificationCodeSentNewEmail}
                                </p>
                                <div className="space-y-1.5">
                                  <Label htmlFor="account-email-otp">
                                    {t.emailOtpCode}
                                  </Label>
                                  <Input
                                    id="account-email-otp"
                                    inputMode="numeric"
                                    value={emailOtp}
                                    onChange={(e) =>
                                      setEmailOtp(
                                        e.target.value
                                          .replace(/\D/g, '')
                                          .slice(0, 6),
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={confirmEmailChange}
                                    disabled={
                                      twoFactorPending || emailOtp.length < 6
                                    }
                                  >
                                    {t.verifyAndUpdateEmail}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEmailStep(1)}
                                  >
                                    {t.back}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}

                        {isOpen && row.key === 'twofa' ? (
                          <div className="space-y-3 border-t bg-muted/30 px-4 py-4">
                            {twoFaStep === 1 ? (
                              <>
                                <div className="space-y-1.5">
                                  <Label htmlFor="account-2fa-password">
                                    {t.currentPassword}
                                  </Label>
                                  <Input
                                    id="account-2fa-password"
                                    type="password"
                                    value={twoFactorPassword}
                                    onChange={(e) =>
                                      setTwoFactorPassword(e.target.value)
                                    }
                                  />
                                </div>
                                {twoFactorEnabled ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={disableTwoFactor}
                                    disabled={
                                      twoFactorPending || !twoFactorPassword
                                    }
                                  >
                                    {t.disable2fa}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={enableTwoFactor}
                                    disabled={
                                      twoFactorPending || !twoFactorPassword
                                    }
                                  >
                                    {t.next}
                                  </Button>
                                )}
                              </>
                            ) : null}
                            {twoFaStep === 2 && twoFactorUri ? (
                              <>
                                <div className="space-y-1.5">
                                  <Label>{t.scanQrFor2fa}</Label>
                                  <img
                                    src={twoFactorQrCode}
                                    alt={t.twoFactorQrCodeAlt}
                                    className="h-44 w-44 rounded-md border bg-white p-2"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="account-2fa-otp">
                                    {t.otpCode}
                                  </Label>
                                  <Input
                                    id="account-2fa-otp"
                                    inputMode="numeric"
                                    value={twoFactorCode}
                                    onChange={(e) =>
                                      setTwoFactorCode(
                                        e.target.value
                                          .replace(/\D/g, '')
                                          .slice(0, 6),
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={verifyTwoFactorSetup}
                                    disabled={
                                      twoFactorPending ||
                                      twoFactorCode.length < 6
                                    }
                                  >
                                    {t.verify2faCode}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={resetTwoFactorFlow}
                                    disabled={twoFactorPending}
                                  >
                                    {t.back}
                                  </Button>
                                </div>
                              </>
                            ) : null}
                            {twoFaStep === 3 ? (
                              <p className="text-sm text-muted-foreground">
                                {t.twoFactorEnabledMessage}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {isOpen && row.key === 'password' ? (
                          <div className="space-y-3 border-t bg-muted/30 px-4 py-4">
                            {passwordStep === 1 ? (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  {t.changePasswordDescription}
                                </p>
                                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
                                  <Turnstile
                                    key={passwordCaptchaVersion}
                                    siteKey={
                                      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
                                    }
                                    options={{ size: 'flexible' }}
                                    onSuccess={setPasswordTurnstileToken}
                                    onExpire={() => {
                                      setPasswordTurnstileToken('')
                                      toast(
                                        'CAPTCHA expired. Please complete it again.',
                                      )
                                    }}
                                    onError={() => {
                                      setPasswordTurnstileToken('')
                                      toast(
                                        'CAPTCHA initialization failed. Please try again.',
                                      )
                                    }}
                                  />
                                ) : null}
                                <Button
                                  size="sm"
                                  onClick={sendPasswordResetOtp}
                                  disabled={
                                    twoFactorPending ||
                                    (Boolean(
                                      process.env
                                        .NEXT_PUBLIC_TURNSTILE_SITE_KEY,
                                    ) &&
                                      !passwordTurnstileToken)
                                  }
                                >
                                  {t.next}
                                </Button>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  {t.verificationCodeSentEmail}
                                </p>
                                <div className="space-y-1.5">
                                  <Label htmlFor="account-password-otp">
                                    {t.emailOtpCode}
                                  </Label>
                                  <Input
                                    id="account-password-otp"
                                    inputMode="numeric"
                                    value={passwordOtp}
                                    onChange={(e) =>
                                      setPasswordOtp(
                                        e.target.value
                                          .replace(/\D/g, '')
                                          .slice(0, 6),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="account-new-password">
                                    {t.newPassword || 'New password'}
                                  </Label>
                                  <Input
                                    id="account-new-password"
                                    type="password"
                                    value={changePasswordValue}
                                    onChange={(e) =>
                                      setChangePasswordValue(e.target.value)
                                    }
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={confirmPasswordReset}
                                    disabled={
                                      twoFactorPending ||
                                      passwordOtp.length < 6 ||
                                      !changePasswordValue
                                    }
                                  >
                                    {t.updatePassword || 'Update password'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setPasswordStep(1)
                                      setPasswordOtp('')
                                    }}
                                  >
                                    {t.back}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.signOut}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.signOutHelp}
                </p>
              </div>
              <Button
                id="settings-account-signout"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await authClient.signOut()
                  await refetchSession()
                  navigate(signInHref)
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t.signOut}
              </Button>
            </div>

            {isAnySignedIn ? (
              <div
                id="settings-account-delete"
                className="flex items-center justify-between gap-3 rounded-lg border border-destructive/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">
                    {t.deleteAccount}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.deleteAccountPermanentHelp}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteAccountOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t.deleteAccount}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => navigate(signInHref)}>
              {t.signIn}
            </Button>
            <Button onClick={() => navigate(signInHref)}>{t.signUp}</Button>
          </div>
        )}
      </div>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteAccountConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteAccountConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm-input">
              DELETE MY ACCOUNT
            </Label>
            <Input
              id="delete-account-confirm-input"
              value={deleteAccountConfirmText}
              onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void deleteAccount()
              }}
              disabled={
                isDeletingAccount ||
                deleteAccountConfirmText !== 'DELETE MY ACCOUNT'
              }
            >
              {isDeletingAccount ? t.deleting : t.confirmDeleteAccount}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
