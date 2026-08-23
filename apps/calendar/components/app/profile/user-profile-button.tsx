'use client'

import { useEffect, useRef, useState } from 'react'
import {
  LogOut,
  CircleUser,
  Trash2,
  Mail,
  Upload,
  BarChart2,
  Settings,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { toast } from 'sonner'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import QRCodeStyling from 'qr-code-styling'
import { cn } from '@zntr/utils'

export type UserProfileSection = 'profile' | 'delete' | 'signout'

type UserProfileButtonProps = {
  variant?: React.ComponentProps<typeof Button>['variant']
  className?: string
  mode?: 'dropdown' | 'settings'
  _onNavigateToSettings?: (section: UserProfileSection) => void
  onNavigateToView?: (view: 'analytics' | 'settings') => void
  focusSection?: UserProfileSection | null
}

export default function UserProfileButton({
  variant = 'ghost',
  className = '',
  mode = 'dropdown',
  _onNavigateToSettings,
  onNavigateToView,
  focusSection = null,
}: UserProfileButtonProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const { data: session } = authClient.useSession()
  const user: any = session?.user
  const isSignedIn = Boolean(session?.user)
  const router = useRouter()
  const isAnySignedIn = isSignedIn

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
  const twoFactorQrCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (mode !== 'settings' || !focusSection) return
    const target = document.getElementById(`settings-account-${focusSection}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusSection, mode])

  useEffect(() => {
    if (!deleteAccountOpen) {
      setDeleteAccountConfirmText('')
    }
  }, [deleteAccountOpen])

  useEffect(() => {
    setTwoFactorEnabled(Boolean((session as any)?.user?.twoFactorEnabled))
  }, [session])

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
    const res = await authClient.emailOtp.requestEmailChange({
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
    const res = await authClient.emailOtp.changeEmail({
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
    await (authClient as any).$store.atoms.session.get().refetch()
    setEmailStep(1)
    setTwoFactorPending(false)
  }

  async function sendPasswordResetOtp() {
    if (!user?.email) return
    setTwoFactorPending(true)
    const res = await (authClient as any).emailOtp.requestPasswordReset({
      email: user.email,
    })
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
    const setupRes = await authClient.twoFactor.enable({
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
    const disableRes = await authClient.twoFactor.disable({
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
    const verifyRes = await authClient.twoFactor.verifyTotp({
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
      const response = await fetch('/api/account', { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to delete account data')
      }

      await authClient.signOut()

      toast(t.accountDeleted)
      router.replace('/')
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
      {mode === 'dropdown' ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isSignedIn ? (
              <Button
                variant={variant}
                size="icon"
                className={cn(
                  'rounded-full overflow-hidden h-8 w-8 p-0',
                  className,
                )}
              >
                <img
                  src={user?.image || '/user.png'}
                  alt="avatar"
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  fetchPriority="high"
                />
              </Button>
            ) : (
              <Button variant={variant} size="icon" className={className}>
                <CircleUser className="h-4 w-4" />
              </Button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {!isAnySignedIn ? (
              <>
                <DropdownMenuItem onClick={() => router.push('/sign-in')}>
                  {t.signIn}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/sign-up')}>
                  {t.signUp}
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onClick={() => onNavigateToView?.('settings')}>
              <Settings className="mr-2 h-4 w-4" />
              {t.settings}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigateToView?.('analytics')}>
              <BarChart2 className="mr-2 h-4 w-4" />
              {t.analytics}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="space-y-6">
          {isAnySignedIn ? (
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
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-gray-500/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Upload className="h-5 w-5 text-white" />
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
                        <Label htmlFor="profile-first-name">
                          {t.firstName}
                        </Label>
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
              {isSignedIn ? (
                <section
                  className="space-y-2"
                  aria-label={t.twoFactorAuthentication}
                >
                  <div className="divide-y rounded-lg border">
                    {(
                      [
                        {
                          key: 'emails' as const,
                          icon: <Mail className="h-4 w-4" />,
                          title: t.accountEmailManagement,
                          summary: user?.email || '-',
                        },
                        {
                          key: 'twofa' as const,
                          icon: <ShieldCheck className="h-4 w-4" />,
                          title: t.twoFactorAuthentication,
                          summary: twoFactorEnabled
                            ? t.twoFactorEnabledMessage
                            : t.twoFactorAuthenticationDescription,
                        },
                        {
                          key: 'password' as const,
                          icon: <KeyRound className="h-4 w-4" />,
                          title: t.changePassword,
                          summary: t.changePasswordDescription,
                        },
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
                                  <Button
                                    size="sm"
                                    onClick={sendPasswordResetOtp}
                                    disabled={twoFactorPending}
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
                    router.refresh()
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.signOut}
                </Button>
              </div>

              {isSignedIn ? (
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
              <Button variant="outline" onClick={() => router.push('/sign-in')}>
                {t.signIn}
              </Button>
              <Button onClick={() => router.push('/sign-up')}>
                {t.signUp}
              </Button>
            </div>
          )}
        </div>
      )}

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
