// The handle at the top of a sheet (phones only, index.css): it shows the sheet can be pulled
// down and takes the drag (features/layout/dragDismiss.js). Hidden from screen readers: the
// close button and Escape do the same.
export default function SheetGrabber() {
    return <span data-sheet-grabber="" aria-hidden="true" />;
}
