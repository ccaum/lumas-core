package processor

import (
  "fmt"
  "image"
  //"strconv"
	. "github.com/3d0c/gmf"
  "gocv.io/x/gocv"
)

const MinimumArea = 3000
const WidthPadding = .05
const HeightPadding = .05

type Motion struct {
  MotionDetected bool
  Frame *Frame
  MotionAreas []image.Rectangle
}

func DetectMotion(frames <-chan *Frame, result chan<- *Motion, srcCodecCtx *CodecCtx, timeBase AVR) {

  window := gocv.NewWindow("Motion Window")
  defer window.Close()

  prevFrame := gocv.NewMat()
  defer prevFrame.Close()
  curFrame  := gocv.NewMat()
  defer curFrame.Close()

  height := srcCodecCtx.Height()
  width  := srcCodecCtx.Width()

  frameDelta := gocv.NewMat()
  defer frameDelta.Close()

  thresh := gocv.NewMat()
  defer thresh.Close()

  for frame := range frames {
    if prevFrame.Empty() {
      var err error
      ret, err := frameToMat(frame, srcCodecCtx, timeBase)
      if (err != nil) {
        fmt.Println("Could not convert frame to MAT")
      }
      retCopy := *ret
      gocv.CvtColor(retCopy, &prevFrame, gocv.ColorBGRToGray)

      continue
    } else {
      ret, err := frameToMat(frame, srcCodecCtx, timeBase)
      if (err != nil) {
        fmt.Println("Could not convert frame to MAT")
      }
      retCopy := *ret
      gocv.CvtColor(retCopy, &curFrame, gocv.ColorBGRToGray)
    }

    gocv.AbsDiff(prevFrame, curFrame, &frameDelta)
    gocv.Threshold(frameDelta, &thresh, 3, 255, gocv.ThresholdBinary)

    kernel := gocv.GetStructuringElement(gocv.MorphRect, image.Pt(3, 3))
		defer kernel.Close()
		gocv.Dilate(thresh, &thresh, kernel)

    motion := new(Motion)
    motion.MotionDetected = false

    contours := gocv.FindContours(thresh, gocv.RetrievalExternal, gocv.ChainApproxSimple)
		for _, c := range contours {
	    area := gocv.ContourArea(c)
      if area < MinimumArea {
        continue
      }

      motion.MotionDetected = true
      fmt.Println("motion detected")

      rect := gocv.BoundingRect(c)
      x := rect.Min.X
      y := rect.Min.Y
      w := rect.Size().X
      h := rect.Size().Y

      //Apply padding of the motion area
      widthPadding := int(float64(width) * WidthPadding)
      heightPadding := int(float64(height) * HeightPadding)
      x = x-(widthPadding)
      w = w+(widthPadding*2)
      y = y-(heightPadding)
      h = h+(heightPadding*2)

      rectangle := image.Rect(x, y, x+w, y+h)

      motion.MotionAreas = append(motion.MotionAreas, rectangle)
	  }

    if motion.MotionDetected == true {
      motion.Frame = frame
    }

    window.IMShow(curFrame)
    if window.WaitKey(1) == 27 {
			break
		}
    prevFrame = curFrame

    //Return our results to the channel
    result <- motion
  }
}
