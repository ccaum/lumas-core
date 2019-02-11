package processor

/*
#cgo pkg-config: libavformat libavcodec

#include <stdlib.h>
#include "libswscale/swscale.h"
#include "libavcodec/avcodec.h"
*/
import "C"

import (
  "runtime/debug"
  "log"
	"github.com/3d0c/gmf"
  "gocv.io/x/gocv"
)

func isMatEqualSize(frame1Mat *gocv.Mat, frame2Mat *gocv.Mat) bool {
  f1s := frame1Mat.Size()
  f2s := frame2Mat.Size()

  if (f1s[0] != f2s[0]) { return false}
  if (f1s[1] != f2s[1]) { return false}

  return true
}

func frameToMat(frame *gmf.Frame, srcCodecCtx *gmf.CodecCtx, timeBase gmf.AVR) (*gocv.Mat, error) {
  w := srcCodecCtx.Width()
  h := srcCodecCtx.Height()

  codec, err := gmf.FindEncoder(gmf.AV_CODEC_ID_TIFF)
  if err != nil {
		fatal(err)
	}

  cc := gmf.NewCodecCtx(codec)
	defer gmf.Release(cc)

  cc.SetPixFmt(C.AV_PIX_FMT_GRAY8).SetWidth(w).SetHeight(h).SetTimeBase(timeBase)

  if codec.IsExperimental() {
		cc.SetStrictCompliance(gmf.FF_COMPLIANCE_EXPERIMENTAL)
	}

	if err := cc.Open(nil); err != nil {
    rmat := gocv.NewMat()
    defer rmat.Close()
    return &rmat, err
	}

  pkt, err := frame.Encode(cc)
  if (err != nil) {
    rmat := gocv.NewMat()
    defer rmat.Close()
    return &rmat, err
  }

  mat, err := gocv.IMDecode(pkt.Data(), 1)
  if (err != nil) {
    rmat := gocv.NewMat()
    defer rmat.Close()
    return &rmat, err
  }

  return &mat, err
}

func fatal(err error) {
	debug.PrintStack()
	log.Fatal(err)
}

func assert(i interface{}, err error) interface{} {
	if err != nil {
		fatal(err)
	}

	return i
}
