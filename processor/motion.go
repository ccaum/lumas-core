package processor

import (
  "fmt"
  "image"
  //"image/color"
	. "github.com/3d0c/gmf"
  "gocv.io/x/gocv"
)

const MinimumArea = 3000
const WidthPadding = .05
const HeightPadding = .05

type Motion struct {
  MotionDetected bool
  FramePktPts int64
  MotionAreas []image.Rectangle
}

func DetectMotion(frames <-chan *Frame, results chan<- *Motion, srcCodecCtx *CodecCtx, timeBase AVR) {

  //window := gocv.NewWindow("Motion Window")
  //defer window.Close()

  prevFrame := gocv.NewMat()
  defer prevFrame.Close()

  curFrame  := gocv.NewMat()
  defer curFrame.Close()

  height := srcCodecCtx.Height()
  width  := srcCodecCtx.Width()

  for frame := range frames {
    defer frame.Free()

    if prevFrame.Empty() {
      var err error
      ret, err := frameToMat(frame, srcCodecCtx, timeBase)
      defer ret.Close()
      if (err != nil) {
        fmt.Println("Could not convert frame to MAT")
      }
      prevFrame = *ret
      //Finding contours can only work with grayscale images
      //This Mat copying is horribly inefficient. Find a better way
      //cvtMat := gocv.NewMat()
      //defer cvtMat.Close()
      //ret.CopyTo(&cvtMat)
      //gocv.CvtColor(ret, &prevFrame, gocv.ColorBGRToGray)

      //cvtMat.Close()
      ret.Close()

      continue
    } else {
      ret, err := frameToMat(frame, srcCodecCtx, timeBase)
      defer ret.Close()
      if (err != nil) {
        fmt.Println("Could not convert frame to MAT")
      }
      curFrame = *ret
      //Finding contours can only work with grayscale images
      //This Mat copying is horribly inefficient. Find a better way
      //cvtMat := gocv.NewMat()
      //defer cvtMat.Close()
      //ret.CopyTo(&cvtMat)
      //gocv.CvtColor(ret, &curFrame, gocv.ColorBGRToGray)

      //cvtMat.Close()
      ret.Close()
    }


    motion := new(Motion)
    motion.MotionDetected = false
    motion.FramePktPts = frame.PktPts()
    frame.Free()

    frameDelta := gocv.NewMat()
    defer frameDelta.Close()

    thresh := gocv.NewMat()
    defer thresh.Close()

    gocv.AbsDiff(prevFrame, curFrame, &frameDelta)
    gocv.Threshold(frameDelta, &thresh, 25, 255, gocv.ThresholdBinary)

    kernel := gocv.GetStructuringElement(gocv.MorphRect, image.Pt(3, 3))
		defer kernel.Close()
		gocv.Dilate(thresh, &thresh, kernel)

    img := gocv.NewMat()
    curFrame.CopyTo(&img)

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

      //statusColor := color.RGBA{255, 0, 0, 0}
      //gocv.DrawContours(&img, contours, i, statusColor, 2)
      //gocv.Rectangle(&img, rect, color.RGBA{0, 0, 255, 0}, 2)

      motion.MotionAreas = append(motion.MotionAreas, rectangle)
	  }

    //window.IMShow(img)
    //if window.WaitKey(100) == 27 {
    //  break
    //}

    curFrame.CopyTo(&prevFrame)

    //Return our results to the channel
    results <- motion

  }
}
