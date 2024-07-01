import {
	AssetRecordType,
	Editor,
	SVGContainer,
	TLImageShape,
	TLShapeId,
	createShapeId,
	track,
} from '@tldraw/editor'
import { Tldraw, useEditor } from '@tldraw/tldraw'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import './image-annotator.css'

import { FileHelpers, MediaHelpers } from '@tldraw/utils'

export interface AnnotatorImage {
	src: string
	width: number
	height: number
	type: string
}

type State =
	| {
			phase: 'pick'
	  }
	| {
			phase: 'annotate'
			id: string
			image: AnnotatorImage
	  }
	| {
			phase: 'export'
			result: Blob
	  }

export function ImagePicker({
	onChooseImage,
}: {
	onChooseImage: (image: { src: string; width: number; height: number; type: string }) => void
}) {
	const [isLoading, setIsLoading] = useState(false)
	function onClickChooseImage() {
		const input = window.document.createElement('input')
		input.type = 'file'
		input.addEventListener('change', async (e) => {
			const fileList = (e.target as HTMLInputElement).files
			if (!fileList || fileList.length === 0) return
			const file = fileList[0]

			setIsLoading(true)
			try {
				const dataUrl = await FileHelpers.blobToDataUrl(file)
				const { w, h } = await MediaHelpers.getImageSize(file)
				onChooseImage({ src: dataUrl, width: w, height: h, type: file.type })
			} finally {
				setIsLoading(false)
			}
		})
		input.click()
	}

	async function onChooseExample(src: string) {
		setIsLoading(true)
		try {
			const image = await fetch(src)
			const blob = await image.blob()
			const { w, h } = await MediaHelpers.getImageSize(blob)
			onChooseImage({ src, width: w, height: h, type: blob.type })
		} finally {
			setIsLoading(false)
		}
	}

	if (isLoading) {
		return <div className="ImagePicker">Loading...</div>
	}

	const anakin = 'https://picsum.photos/200/300'
	const distractedBf = 'https://picsum.photos/400/400'
	const expandingBrain = 'https://picsum.photos/300/200'

	return (
		<div className="ImagePicker">
			<button onClick={onClickChooseImage}>Choose an image</button>
			<div className="ImagePicker-exampleLabel">or use an example:</div>
			<div className="ImagePicker-examples">
				<img src={anakin} alt="anakin" onClick={() => onChooseExample(anakin)} />
				<img
					src={distractedBf}
					alt="distracted boyfriend"
					onClick={() => onChooseExample(distractedBf)}
				/>
				<img
					src={expandingBrain}
					alt="expanding brain"
					onClick={() => onChooseExample(expandingBrain)}
				/>
			</div>
		</div>
	)
}

export function ImageExport({ result, onStartAgain }: { result: Blob; onStartAgain: () => void }) {
	const [src, setSrc] = useState<string | null>(null)
	useLayoutEffect(() => {
		const url = URL.createObjectURL(result)
		setSrc(url)
		return () => URL.revokeObjectURL(url)
	}, [result])

	function onDownload() {
		if (!src) return

		const a = document.createElement('a')
		a.href = src
		a.download = 'annotated-image.png'
		a.click()
	}

	const [didCopy, setDidCopy] = useState(false)
	function onCopy() {
		navigator.clipboard.write([new ClipboardItem({ [result.type]: result })])
		setDidCopy(true)
	}
	useEffect(() => {
		if (!didCopy) return
		const t = setTimeout(() => setDidCopy(false), 2000)
		return () => clearTimeout(t)
	}, [didCopy])

	return (
		<div className="ImageExport">
			{src && <img src={src} />}
			<div className="ImageExport-buttons">
				<button onClick={onCopy}>{didCopy ? 'Copied!' : 'Copy'}</button>
				<button onClick={onDownload}>Download</button>
			</div>
			<button onClick={onStartAgain}>Start Again</button>
		</div>
	)
}

// TODO:
// - prevent changing pages (create page, change page, move shapes to new page)
// - prevent locked shape context menu
// - inertial scrolling for constrained camera
export function ImageAnnotationEditor({
	image,
	onDone,
}: {
	image: AnnotatorImage
	onDone: (result: Blob) => void
}) {
	const [imageShapeId, setImageShapeId] = useState<TLShapeId | null>(null)
	const [editor, setEditor] = useState(null as Editor | null)

	function onMount(editor: Editor) {
		setEditor(editor)
	}

	useEffect(() => {
		if (!editor) return

		// Turn off debug mode
		editor.updateInstanceState({ isDebugMode: false })

		// Create the asset and image shape
		const assetId = AssetRecordType.createId()
		editor.createAssets([
			{
				id: assetId,
				typeName: 'asset',
				type: 'image',
				meta: {},
				props: {
					w: image.width,
					h: image.height,
					mimeType: image.type,
					src: image.src,
					name: 'image',
					isAnimated: false,
				},
			},
		])
		const shapeId = createShapeId()
		editor.createShape<TLImageShape>({
			id: shapeId,
			type: 'image',
			x: 0,
			y: 0,
			isLocked: true,
			props: {
				w: image.width,
				h: image.height,
				assetId,
			},
		})

		// Make sure the shape is at the bottom of the page
		function makeSureShapeIsAtBottom() {
			if (!editor) return

			const shape = editor.getShape(shapeId)
			if (!shape) return

			const pageId = editor.getCurrentPageId()

			// The shape should always be the child of the current page
			if (shape.parentId !== pageId) {
				editor.moveShapesToPage([shape], pageId)
			}

			// The shape should always be at the bottom of the page's children
			const siblings = editor.getSortedChildIdsForParent(pageId)
			const currentBottomShape = editor.getShape(siblings[0])!
			if (currentBottomShape.id !== shapeId) {
				editor.sendToBack([shape])
			}
		}

		makeSureShapeIsAtBottom()

		const removeOnCreate = editor.sideEffects.registerAfterCreateHandler(
			'shape',
			makeSureShapeIsAtBottom
		)

		const removeOnChange = editor.sideEffects.registerAfterChangeHandler(
			'shape',
			makeSureShapeIsAtBottom
		)

		// The shape should always be locked
		const cleanupKeepShapeLocked = editor.sideEffects.registerBeforeChangeHandler(
			'shape',
			(prev, next) => {
				if (next.id !== shapeId) return next
				if (next.isLocked) return next
				return { ...prev, isLocked: true }
			}
		)

		// Reset the history
		editor.history.clear()
		setImageShapeId(shapeId)

		return () => {
			removeOnChange()
			removeOnCreate()
			cleanupKeepShapeLocked()
		}
	}, [image, editor])

	useEffect(() => {
		if (!editor) return
		if (!imageShapeId) return

		/**
		 * We don't want the user to be able to scroll away from the image, or zoom it all the way out. This
		 * component hooks into camera updates to keep the camera constrained - try uploading a very long,
		 * thin image and seeing how the camera behaves.
		 */
		editor.setCameraOptions({
			constraints: {
				initialZoom: 'fit-max',
				baseZoom: 'default',
				bounds: { w: image.width, h: image.height, x: 0, y: 0 },
				padding: { x: 32, y: 64 },
				origin: { x: 0.5, y: 0.5 },
				behavior: 'contain',
			},
			zoomSteps: [1, 2, 4, 8],
			zoomSpeed: 1,
			panSpeed: 1,
			isLocked: false,
		})
		editor.setCamera(editor.getCamera(), { reset: true })
	}, [editor, imageShapeId, image])

	return (
		<Tldraw
			onMount={onMount}
			components={{
				// grey-out the area outside of the image
				InFrontOfTheCanvas: useCallback(() => {
					if (!imageShapeId) return null
					return <ImageBoundsOverlay imageShapeId={imageShapeId} />
				}, [imageShapeId]),
				// add a "done" button in the top right for when the user is ready to export
			}}
		/>
	)
}

/**
 * When we export, we'll only include the bounds of the image itself, so show an overlay on top of
 * the canvas to make it clear what will/won't be included. Check `image-annotator.css` for more on
 * how this works.
 */
const ImageBoundsOverlay = track(function ImageBoundsOverlay({
	imageShapeId,
}: {
	imageShapeId: TLShapeId
}) {
	const editor = useEditor()
	const image = editor.getShape(imageShapeId) as TLImageShape
	if (!image) return null

	const imagePageBounds = editor.getShapePageBounds(imageShapeId)!
	const viewport = editor.getViewportScreenBounds()
	const topLeft = editor.pageToViewport(imagePageBounds)
	const bottomRight = editor.pageToViewport({ x: imagePageBounds.maxX, y: imagePageBounds.maxY })

	const path = [
		// start by tracing around the viewport itself:
		`M ${-10} ${-10}`,
		`L ${viewport.maxX + 10} ${-10}`,
		`L ${viewport.maxX + 10} ${viewport.maxY + 10}`,
		`L ${-10} ${viewport.maxY + 10}`,
		`Z`,

		// then cut out a hole for the image:
		`M ${topLeft.x} ${topLeft.y}`,
		`L ${bottomRight.x} ${topLeft.y}`,
		`L ${bottomRight.x} ${bottomRight.y}`,
		`L ${topLeft.x} ${bottomRight.y}`,
		`Z`,
	].join(' ')

	return (
		<SVGContainer className="ImageOverlayScreen">
			<path d={path} fillRule="evenodd" />
		</SVGContainer>
	)
})

function DoneButton({
	imageShapeId,
	onClick,
}: {
	imageShapeId: TLShapeId
	onClick: (result: Blob) => void
}) {
	const editor = useEditor()
	return (
		<button
			className="DoneButton"
			onClick={async () => {
				const blob = await exportToBlob({
					editor,
					ids: Array.from(editor.getCurrentPageShapeIds()),
					format: 'png',
					opts: {
						background: true,
						bounds: editor.getShapePageBounds(imageShapeId)!,
						padding: 0,
						scale: 1,
					},
				})

				onClick(blob)
			}}
		>
			Done
		</button>
	)
}

export default function ImageAnnotatorWrapper() {
	const [state, setState] = useState<State>({ phase: 'pick' })

	switch (state.phase) {
		case 'pick':
			return (
				<div className="ImageAnnotator">
					<ImagePicker
						onChooseImage={(image) =>
							setState({ phase: 'annotate', image, id: Math.random().toString(36) })
						}
					/>
				</div>
			)
		case 'annotate':
			return (
				<div className="ImageAnnotator">
					<ImageAnnotationEditor
						// remount tldraw if the image/id changes:
						key={state.id}
						image={state.image}
						onDone={(result) => setState({ phase: 'export', result })}
					/>
				</div>
			)
		case 'export':
			return (
				<div className="ImageAnnotator">
					<ImageExport result={state.result} onStartAgain={() => setState({ phase: 'pick' })} />
				</div>
			)
	}
}
