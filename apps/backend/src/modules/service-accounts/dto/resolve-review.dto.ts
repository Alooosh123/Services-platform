import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class ResolveReviewDto {
  @ApiProperty({
    description: 'قرار المشغل الإداري',
    enum: ['APPROVE', 'REJECT', 'NEEDS_INFO'],
    example: 'APPROVE',
  })
  @IsNotEmpty({ message: 'القرار مطلوب' })
  @IsIn(['APPROVE', 'REJECT', 'NEEDS_INFO'], {
    message: 'القرار يجب أن يكون APPROVE أو REJECT أو NEEDS_INFO',
  })
  decision: 'APPROVE' | 'REJECT' | 'NEEDS_INFO';

  @ApiProperty({
    description: 'ملاحظات المشغل الإداري وسبب القرار',
    example: 'تم التحقق من بيانات اللاعب وسجل العمليات واعتماد الحساب المرجعي.',
  })
  @IsNotEmpty({ message: 'ملاحظات المشغل الإداري مطلوبة إجبارياً للتدقيق' })
  @IsString()
  operatorNotes: string;
}
