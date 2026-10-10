// Fixed bilingual copy for components/sermon/SermonBulletinActions.tsx.
export const sermonBulletinActionsText = {
    chooseAPdfFileUpTo20Mb: { en: 'Choose a PDF file up to 20 MB.', zh: '请选择不超过 20 MB 的 PDF 文件。' } as const,
    bulletinUploaded: { en: 'Bulletin uploaded.', zh: '周报上传成功。' } as const,
    youDoNotHavePermissionToUploadBulletins: { en: 'You do not have permission to upload bulletins.', zh: '你没有上传周报的权限。' } as const,
    bulletinStorageIsUnavailablePleaseContactAChurchAdministrator: { en: 'Bulletin storage is unavailable. Please contact a church administrator.', zh: '周报存储暂时不可用，请联系教会管理员检查存储配置。' } as const,
    uploadFailedCheckThePdfAndTryAgain: { en: 'Upload failed. Check the PDF and try again.', zh: '上传失败，请检查 PDF 后重试。' } as const,
    viewSundayBulletinFor: { en: (value0: unknown) => `View Sunday bulletin for ${value0}`, zh: (value0: unknown) => `查看 ${value0} 主日周报` },
    sundayBulletin: { en: 'Sunday bulletin', zh: '主日周报' } as const,
    noMatchingSundayBulletin: { en: 'No matching Sunday bulletin', zh: '无对应主日周报' } as const,
    bulletinUnavailable: { en: 'Bulletin unavailable', zh: '周报暂不可用' } as const,
    loadingBulletin: { en: 'Loading bulletin…', zh: '正在加载周报…' } as const,
    bulletinNotUploaded: { en: 'Bulletin not uploaded', zh: '周报待上传' } as const,
    uploading: { en: 'Uploading…', zh: '正在上传…' } as const,
    uploadBulletin: { en: 'Upload bulletin', zh: '上传周报' } as const,
    uploadBulletinPdfFor: { en: (value0: unknown) => `Upload bulletin PDF for ${value0}`, zh: (value0: unknown) => `上传 ${value0} 周报 PDF` },
    pdfUpTo20MbUploadingAgainReplacesThis: { en: 'PDF, up to 20 MB. Uploading again replaces this date’s bulletin.', zh: 'PDF，最大 20 MB。再次上传将替换这一天的周报。' } as const,
    retry: { en: 'Retry', zh: '重试' } as const,
};
